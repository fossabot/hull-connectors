import _ from "lodash";
import moment from "moment";

const { SkippableError } = require("hull/src/errors");

export default async function handle({ request, client, connector }, message) {
  const { private_settings } = connector;
  const { api_key } = private_settings;
  const { user } = message;

  if (!api_key) {
    throw new SkippableError("Connector settings are missing api_key.");
  }

  const {
    domain_attribute,
    company_attribute,
    first_name_attribute,
    last_name_attribute
  } = private_settings;


  if (!first_name_attribute || !last_name_attribute) {
    throw new SkippableError("First and last name must be mapped in the connector settings.");
  }

  if (!domain_attribute && !company_attribute) {
    throw new SkippableError("Domain or company name must be mapped in the connector settings.");
  }

  const payload = [
    'domain',
    'company',
    'first_name',
    'last_name'
  ].reduce((acc, propertyName) => {
    const attributeName = private_settings[`${propertyName}_attribute`];
    if (!attributeName) {
      return acc;
    }

    const attributeValue = user[attributeName];

    if (!attributeValue) {
      return acc;
    }

    acc[propertyName] = attributeValue;
    return acc;
  }, {
    api_key
  });

  if (!payload['first_name'] || !payload['last_name']) {
    throw new SkippableError("First or last name not present on this user.");
  }

  if (!payload['domain'] && !payload['company']) {
    throw new SkippableError("Domain or company name not present on this user.");
  }

  const response = await request
    .get("https://api.hunter.io/v2/email-finder")
    .query(payload);

  if (response.body && response.body.data.email) {
    if (response.body.data.score > 90) {
      const userClaims = {
        external_id: user.external_id,
        anonymous_id: _.first(user.anonymous_ids),
        email: response.body.data.email
      };
      const traits = {
        "hunter/enriched_at": moment().format(),
        "hunter/email": response.body.data.email,
        "hunter/score": response.body.data.score
      };
      return client.asUser(userClaims).traits(traits);
    }
    throw new SkippableError(`Hunter.io returned score below 90: ${response.body.data.score}, ignoring results.`);
  }

  throw new Error("Hunter.io returned unknown API response, if error persist contact Hull support.");
}
/* @flow */
import type { THullUserUpdateMessage, THullAccountUpdateMessage } from "hull";

const _ = require("lodash");

class QueryUtil {
  extractUniqueValues(messages: Array<any>, path: string): Array<any> {
    return _.uniq(_.compact(_.map(messages, path)));
  }

  buildQueryOpts(sfEntityType: string, params: Array<Object>): Object {
    if (_.includes(["lead", "contact"], sfEntityType)) {
      return { Email: "email", Id: `salesforce_${sfEntityType}/id` };
    }

    if (sfEntityType === "account") {
      const queryOpts = { Id: "salesforce/id" };
      _.forEach(params, param => {
        _.set(queryOpts, param.service, param.hull);
      });
      return queryOpts;
    }
    return {};
  }

  composeFindQuery(
    messages: Array<THullUserUpdateMessage> | Array<THullAccountUpdateMessage>,
    searchMapping: Object,
    hullEntityType: string
  ): Object {
    // Collect unique terms in message for each field to query by
    const uniqueTerms = _.reduce(
      searchMapping,
      (memo, hullField, salesforceField) => {
        return _.merge(memo, {
          [salesforceField]: this.extractUniqueValues(
            messages,
            `${hullEntityType}.${hullField}`
          )
        });
      },
      {}
    );

    // Build list of predicates from the unique list of terms
    const predicates = _.reduce(
      uniqueTerms,
      (query, terms, fieldName) => {
        // Return early if we don't have any terms for that field
        if (!terms.length) return query;

        // Special treatment for Website
        if (fieldName === "Website") {
          const websites = terms.map(website => {
            if (website.length < 7) {
              return { Website: website };
            }
            return { Website: { $like: `%${website}%` } };
          });
          return [...query, ...websites];
        }

        // Exact match by any of the discovered terms otherwise
        return [...query, { [fieldName]: terms }];
      },
      []
    );

    // Return early if no predicates
    if (predicates.length === 0) return {};

    return { $or: predicates };
  }

  composeFindFields(serviceType: string, mappings: Object): Array<string> {
    serviceType = _.upperFirst(serviceType);

    const objectMappings = _.get(mappings, serviceType, {});
    const { fields = {}, fetchFields = {} } = objectMappings;
    return _.filter(Object.keys(_.merge({}, fields, fetchFields)), field => {
      return !_.isEmpty(field);
    });
  }

  getSoqlFields(
    serviceType: string,
    fields: Array<string>,
    accountClaims: Array<Object>
  ): Object {
    let selectFields: string[] = [];

    const requiredFields = [];
    requiredFields.push("Id");
    switch (serviceType) {
      case "Lead":
        selectFields.push(
          "Id",
          "Email",
          "ConvertedAccountId",
          "ConvertedContactId"
        );
        requiredFields.push("Email");
        break;
      case "Account":
        selectFields.push("Id", "Website");
        if (!_.isNil(accountClaims) && accountClaims.length > 0) {
          selectFields = _.concat(
            selectFields,
            _.map(accountClaims, "service")
          );

          for (let i = 0; i < accountClaims.length; i += 1) {
            const accountClaim = accountClaims[i];
            if (accountClaim.required) {
              requiredFields.push(accountClaim.service);
            }
          }
        }
        break;
      case "Contact":
        selectFields.push("Id", "Email", "AccountId");
        requiredFields.push("Email");
        break;
      case "Task":
        selectFields.push("Id", "Subject", "WhoId", "Who.Type");
        break;
      default:
        selectFields.push("Id");
        break;
    }

    selectFields = _.uniq(fields.concat(selectFields));
    return { selectFields: selectFields.join(","), requiredFields };
  }
}

module.exports = QueryUtil;

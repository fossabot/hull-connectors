// @flow
import type { HullClient, HullContext } from "hull";
import _ from "lodash";
import type { Result, Event } from "../types";

type TraitsSignature =
  | {
      hullClient: $PropertyType<HullClient, "asUser">,
      data: $PropertyType<Result, "userTraits">,
      entity: "user",
      metric: $PropertyType<HullContext, "metric">
    }
  | {
      hullClient: $PropertyType<HullClient, "asAccount">,
      data: $PropertyType<Result, "accountTraits">,
      entity: "account",
      metric: $PropertyType<HullContext, "metric">
    };

type AliasSignature =
  | {
      hullClient: $PropertyType<HullClient, "asUser">,
      data: $PropertyType<Result, "userAliases">,
      entity: "user",
      metric: $PropertyType<HullContext, "metric">
    }
  | {
      hullClient: $PropertyType<HullClient, "asAccount">,
      data: $PropertyType<Result, "accountAliases">,
      entity: "account",
      metric: $PropertyType<HullContext, "metric">
    };

type EventSignature = {
  hullClient: $PropertyType<HullClient, "asUser">,
  data: Array<Event>,
  entity: string,
  metric: $PropertyType<HullContext, "metric">
};

const logIfNested = (client, attrs) => {
  _.map(attrs, (v, k) => {
    if (
      _.isObject(v) &&
      !_.isEqual(_.sortBy(_.keys(v)), ["operation", "value"])
    ) {
      client.logger.info(
        `Nested object { ${JSON.stringify(k)}:${JSON.stringify(
          v
        )} } found in account traits`
      );
    }
  });
};

export const callTraits = async ({
  hullClient,
  data = new Map(),
  entity,
  metric
}: TraitsSignature): Promise<any> => {
  let successful = 0;
  try {
    const responses = await Promise.all(
      Array.from(data, async datum => {
        const [claims, att] = _.map(datum, i => i.toObject());
        const client = hullClient(claims);
        try {
          logIfNested(client, att);
          // Filter undefined attributes
          const attributes = _.omitBy(att, (v, k: any) => k === undefined);
          await client.traits(attributes);
          successful += 1;
          return client.logger.info(`incoming.${entity}.success`, {
            attributes
          });
        } catch (err) {
          return client.logger.error(`incoming.${entity}.error`, {
            hull_summary: `Error saving Attributes: ${err.message ||
              "Unexpected error"}`,
            [entity]: claims,
            errors: err
          });
        }
      })
    );
    if (successful) metric.increment(`ship.incoming.${entity}s`, successful);
    return responses;
  } catch (err) {
    return Promise.reject(err);
  }
};

export const callEvents = async ({
  hullClient,
  data = [],
  entity,
  metric
}: EventSignature): Promise<any> => {
  try {
    let successful = 0;
    const responses = await Promise.all(
      data.map(async ({ event, claims }) => {
        const { eventName, properties, context } = event;
        const client = hullClient(claims);
        try {
          successful += 1;
          await client.track(eventName, properties, {
            ip: "0",
            source: "code",
            ...context
          });
          return client.logger.info("incoming.event.success", {
            eventName,
            properties
          });
        } catch (err) {
          return client.logger.error("incoming.event.error", {
            hull_summary: `Error processing Event: ${err.message ||
              "Unexpected error"}`,
            user: claims,
            errors: err,
            event
          });
        }
      })
    );
    if (successful) metric.increment(`ship.incoming.${entity}`, successful);
    return responses;
  } catch (err) {
    return Promise.reject(err);
  }
};

export const callLinks = async ({
  hullClient,
  data,
  entity,
  metric
}: {
  hullClient: $PropertyType<HullClient, "asUser">,
  data: $PropertyType<Result, "accountLinks">,
  entity: "account",
  metric: $PropertyType<HullContext, "metric">
}): Promise<any> => {
  try {
    let successful = 0;
    const responses = await Promise.all(
      Array.from(data, async ([claims, accountClaims]) => {
        const client = hullClient(claims);
        try {
          successful += 1;
          await client.account(accountClaims).traits({});
          return client.logger.info(`incoming.${entity}.link.success`);
        } catch (err) {
          return client.logger.error(`incoming.${entity}.link.error`, {
            hull_summary: `Error Linking User and account: ${err.message ||
              "Unexpected error"}`,
            user: claims,
            account: accountClaims,
            errors: err
          });
        }
      })
    );
    if (successful) metric.increment(`ship.incoming.${entity}`, successful);
    return responses;
  } catch (err) {
    return Promise.reject(err);
  }
};

export const callAlias = async ({
  hullClient,
  data = new Map(),
  entity,
  metric
}: AliasSignature): Promise<any> => {
  const successful = 0;
  try {
    const responses = await Promise.all(
      Array.from(data, async ([claims, operations]) => {
        const client = hullClient(claims);
        try {
          _.map(operations, (operation, aliasClaims) => {
            if (operation === "alias") {
              client.alias(aliasClaims);
            } else {
              client.unalias(aliasClaims);
            }
          });
          return client.logger.info(`incoming.${entity}.success`, {
            aliases: operations
          });
        } catch (err) {
          console.log(err);
          return client.logger.info(`incoming.${entity}.error`, {
            aliases: operations
          });
        }
      })
    );
    if (successful)
      metric.increment(`ship.incoming.${entity}s.alias`, successful);
    return responses;
  } catch (err) {
    console.log(err);
    return Promise.reject(err);
  }
};

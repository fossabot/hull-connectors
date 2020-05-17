// @flow

import type {
  HullContext,
  // HullResponse,
  HullExternalResponse
} from "hull";
import { asyncComputeAndIngest, varsFromSettings } from "hull-vm";
import callApi from "../lib/call-api";
import updateAgentDetails from "../lib/agent-details";

export default function handler(EntryModel: Object) {
  return async (ctx: HullContext): HullExternalResponse => {
    const { client, connector } = ctx;
    const { private_settings = {} } = connector;
    const { code } = private_settings;

    // Stop if we aren't initialized properly, notifying sender that we couldn't find the proper credentials
    if (!client || !connector) {
      return {
        status: 404,
        data: {
          reason: "connector_not_found",
          message: "We couldn't find a connector for this token"
        }
      };
    }

    try {
      const agent = await updateAgentDetails(ctx, true);
      const { isNew } = agent;
      if (!isNew) {
        client.logger.info("connector.schedule.skip", {
          message: "Phantom didn't change since last time",
          agent
        });
        return {
          status: 200,
          data: {
            ok: true
          }
        };
      }
      const data = await callApi(ctx, agent);

      asyncComputeAndIngest(ctx, {
        source: "phantombuster",
        EntryModel,
        date: agent.date,
        payload: {
          method: "GET",
          url: agent.name,
          agent,
          data,
          variables: varsFromSettings(ctx)
        },
        code,
        preview: false
      });

      return {
        status: 200,
        data: {
          ok: true
        }
      };
    } catch (err) {
      client.logger.error("connector.request.error", {
        ...private_settings,
        error: err
      });
      return {
        status: 500,
        data: {
          error: err
        }
      };
    }
  };
}

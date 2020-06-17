/* @flow */
import type { HullContext, HullExternalResponse } from "hull";

const SyncAgent = require("../lib/sync-agent");
const {
  fetchAllRecords
} = require("../lib/sync-agent/actions/incoming/fetch/fetch-all-records");

const ENTITY = "Lead";

async function fetchAllContacts(ctx: HullContext): HullExternalResponse {
  const syncAgent = new SyncAgent(ctx);

  const privateSettings = ctx.connector.private_settings;

  return fetchAllRecords({ entity: ENTITY, privateSettings, syncAgent }).catch(
    err => {
      ctx.client.logger.error("incoming.job.error", {
        job: "fetch-all-leads",
        message: err.message,
        status: err.status
      });
    }
  );
}

module.exports = fetchAllContacts;

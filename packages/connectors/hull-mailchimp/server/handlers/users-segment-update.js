/* @flow */
import type {
  HullUserSegment,
  HullContext,
  HullNotificationResponse
} from "hull";
import shipAppFactory from "../lib/ship-app-factory";
/**
 * When segment is added or updated make sure its in the segments mapping,
 * and trigger an extract for that segment to update users.
 */
export default async function segmentUpdateHandler(
  ctx: HullContext,
  // TODO: check the exact format of the segment update and delete handlers
  message: Array<HullUserSegment>
): HullNotificationResponse {
  ctx.client.logger.debug("[segmentUpdateHandler] start", { message });

  const { syncAgent } = shipAppFactory(ctx);

  if (!syncAgent.isConfigured()) {
    ctx.client.logger.error("connector.configuration.error", {
      errors: "connector not configured"
    });

    ctx.client.logger.debug("[segmentUpdateHandler] ship not configured");
    return {
      status: 500
    };
  }

  await syncAgent.syncConnector({ forceCheck: true });
  return {
    status: 200
  };
}

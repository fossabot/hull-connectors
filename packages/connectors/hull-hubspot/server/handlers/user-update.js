// @flow

import type { HullContext, HullUserUpdateMessage } from "hull";
import SyncAgent from "../lib/sync-agent";

export default async (
  ctx: HullContext,
  messages: Array<HullUserUpdateMessage>
) => {
  // if (ctx.smartNotifierResponse) {
  //   ctx.smartNotifierResponse.setFlowControl();
  // }
  try {
    const syncAgent = new SyncAgent(ctx);
    await syncAgent.sendUserUpdateMessages(messages);
    return {
      flow_control: {
        type: "next",
        size: parseInt(process.env.FLOW_CONTROL_SIZE, 10) || 100,
        in: parseInt(process.env.FLOW_CONTROL_IN, 10) || 10,
        in_time: parseInt(process.env.FLOW_CONTROL_IN_TIME, 10) || 10
      }
    };
  } catch (err) {
    return {
      flow_control: { type: "retry" }
    };
  }
};

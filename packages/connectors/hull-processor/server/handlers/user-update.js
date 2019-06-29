// @flow
import type {
  HullContext,
  HullUserUpdateMessage,
  HullNotificationResponse
} from "hull";
import asyncComputeIngest from "../lib/async-compute-ingest";

type FlowControl = {
  flow_size?: number,
  flow_in?: number
};
const update = ({ flow_size = 100, flow_in = 10 }: FlowControl) => async (
  ctx: HullContext,
  messages: Array<HullUserUpdateMessage>
): HullNotificationResponse => {
  const { connector } = ctx;
  const { private_settings = {} } = connector;
  const { code = "" } = private_settings;

  // const user_ids = _.map(messages, "user.id");
  try {
    await Promise.all(
      messages.map(payload =>
        asyncComputeIngest(ctx, { payload, code, entity: "user" })
      )
    );
    return {
      flow_control: {
        type: "next",
        size: flow_size,
        in: flow_in
      }
    };
  } catch (err) {
    ctx.client.logger.error("incoming.user.error", { error: err.message });
    return {
      flow_control: {
        type: "retry",
        size: flow_size,
        in: flow_in
      }
    };
  }
};
export default update;

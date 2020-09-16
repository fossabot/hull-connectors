// @flow
import type {
  HullContext,
  HullUserUpdateMessage,
  HullNotificationResponse
} from "hull";
import _ from "lodash";
import { formatPayload } from "hull-vm";
import buildResponse from "../lib/build-response";

type FlowControl = {
  flow_size?: number,
  flow_in?: number
};

const update = ({ flow_size = 100, flow_in = 10 }: FlowControl) => async (
  ctx: HullContext,
  messages: Array<HullUserUpdateMessage>
): HullNotificationResponse => {
  const { connector, client } = ctx;
  const { private_settings = {} } = connector;
  const { code = "", fallbacks } = private_settings;

  // const user_ids = _.map(messages, "user.id");
  try {
    await Promise.all(
      messages.map(async message => {
        const { payload } = formatPayload(ctx, {
          entity: "user",
          message
        });
        const traits = await buildResponse({
          code,
          payload,
          fallbacks
        });
        if (traits && _.size(traits)) {
          client.asUser(message.user).traits(traits);
        }
      })
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
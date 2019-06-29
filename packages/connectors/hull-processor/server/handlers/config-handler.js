// @flow
import type {
  HullContext,
  HullIncomingHandlerMessage,
  HullExternalResponse
} from "hull";
import type { ConfResponse } from "hull-vm";

const confHandler = (
  ctx: HullContext,
  message: HullIncomingHandlerMessage
): HullExternalResponse => {
  const { clientCredentialsEncryptedToken, connector } = ctx;
  const { private_settings = {} } = connector;
  const { code } = private_settings;
  const { hostname } = message;
  if (hostname && clientCredentialsEncryptedToken) {
    return {
      status: 200,
      data: {
        current: {
          connectorId: connector.id,
          code
        }
      }
    };
  }
  return {
    status: 403
  };
};

export default confHandler;

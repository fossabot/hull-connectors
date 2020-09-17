// import Hull from "hull";
// import app from "./app";
//
// const options = {
//   hostSecret: process.env.SECRET || "1234",
//   devMode: process.env.NODE_ENV === "development",
//   port: process.env.PORT || 8082,
//   Hull,
//   skipSignatureValidation: true,
//   installUrl: process.env.INSTALL_URL
// };
//
// const connector = new Hull.Connector(options);
// connector.startApp(app(connector, options));
//
//
//

// @flow

import type { HullConnectorConfig } from "hull";
import manifest from "../manifest.json";
import handlers from "./handlers";

export default function connectorConfig(): HullConnectorConfig {
  const {
    PORT = 8082,
    LOG_LEVEL,
    NODE_ENV,
    SECRET,
    OVERRIDE_FIREHOSE_URL,
    INSTALL_URL
  } = process.env;

  console.log(INSTALL_URL);
  if (!INSTALL_URL) {
    throw new Error("Missing INSTALL_URL environment variable");
  }
  // We're not using default assignments because "null" values makes Flow choke
  const hostSecret = SECRET || "1234";

  return {
    manifest,
    hostSecret,
    devMode: NODE_ENV === "development",
    port: PORT || 8082,
    timeout: "25s",
    handlers: handlers({
      installUrl: INSTALL_URL
    }),
    middlewares: [],
    logsConfig: {
      logLevel: LOG_LEVEL
    },
    clientConfig: {
      firehoseUrl: OVERRIDE_FIREHOSE_URL
    },
    serverConfig: {
      start: true
    }
  };
}
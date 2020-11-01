import Lightweight from "hull-lightweight/server";
import Standard from "hull/server";
import minimist from "minimist";
import path from "path";

(async () => {
  const { PATH_TO_CONNECTOR } = process.env;
  if (!PATH_TO_CONNECTOR) {
    throw new Error(
      "Missing connector - you need to define which connector to start"
    );
  }

  console.log("Start.js, Connector", {
    args: minimist(process.argv),
    PATH_TO_CONNECTOR,
    cwd: process.cwd(),
    PWD: process.env.PWD,
    __dirname
  });

  const connectorPath = path.join(process.cwd(), PATH_TO_CONNECTOR);
  process.chdir(connectorPath);

  try {
    const { default: manifest } = await import(
      `${connectorPath}/manifest.json`
    );
    const { type } = manifest;
    // console.log({manifest, connectorPath})
    if (type) {
      Lightweight({ path: connectorPath, type, manifest });
    } else {
      Standard({ path: connectorPath, manifest });
    }
  } catch (err) {
    console.log(err);
    throw err;
  }
})();

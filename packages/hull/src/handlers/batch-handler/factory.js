// @flow
import type { HullRouteMap, HullBatchHandlersConfiguration } from "../../types";
import getRouter from "../get-router";

const processingMiddleware = require("./processing-middleware");
const errorMiddleware = require("./error-middleware");

/**
 * [notificationHandlerFactory description]
 * @param  {HullBatchHandlersConfiguration} configuration: HullBatchHandlersConfiguration [description]
 * @return {[type]}                [description]
 * @example
 * app.use("/batch", notificationHandler({
 *   "user:update": (ctx, message) => {}
 * }));
 */
function batchExtractHandlerFactory(
  configuration: HullBatchHandlersConfiguration
): HullRouteMap {
  return getRouter({
    requestName: "batch",
    handlerName: "batch",
    handler: processingMiddleware(configuration),
    errorHandler: errorMiddleware,
    options: {
      credentialsFromNotification: false,
      credentialsFromQuery: true,
      strict: false
    }
  });
}

module.exports = batchExtractHandlerFactory;

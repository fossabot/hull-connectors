// @flow
import type { $Response, NextFunction } from "express";
import type {
  HullRequestFull,
  HullSchedulerHandlerConfigurationEntry
} from "../../types";

const { Router } = require("express");
const debug = require("debug")("hull-connector:schedule-handler");
const _ = require("lodash");

const { TransientError } = require("../../errors");
const {
  credentialsFromQueryMiddleware,
  clientMiddleware,
  fullContextBodyMiddleware,
  fullContextFetchMiddleware,
  timeoutMiddleware,
  haltOnTimedoutMiddleware,
  instrumentationContextMiddleware,
  instrumentationTransientErrorMiddleware
} = require("../../middlewares");

/**
 * This handler allows to handle simple, authorized HTTP calls.
 * By default it picks authorization configuration from query.
 *
 * If you need custom way of passing data, you need to use custom middleware before the handler.
 *
 * Optionally it can cache the response, then provide options.cache object with key
 *
 * @param  {Object|Function} configurationEntry [description]
 * @param  {Object}   [configurationEntry.options]
 * @param  {Object}   [configurationEntry.options.cache]
 * @param  {string}   [configurationEntry.options.cache.key]
 * @param  {string}   [configurationEntry.options.cache.options]
 * @return {Function}
 * @example
 * app.use("/list", actionHandler((ctx) => {}))
 */
function scheduleHandlerFactory(
  configurationEntry: HullSchedulerHandlerConfigurationEntry
) {
  const router = Router();
  const { callback, options = {} } = configurationEntry;
  const { disableErrorHandling = false, fireAndForget = false } = options;

  router.use(timeoutMiddleware());
  router.use(credentialsFromQueryMiddleware()); // parse query
  router.use(haltOnTimedoutMiddleware());
  router.use(clientMiddleware()); // initialize client
  router.use(haltOnTimedoutMiddleware());
  router.use(instrumentationContextMiddleware());
  router.use(
    fullContextBodyMiddleware({ requestName: "scheduler", strict: false })
  ); // get rest of the context from body
  router.use(fullContextFetchMiddleware());
  router.use(haltOnTimedoutMiddleware());
  router.use(function scheduleHandler(
    req: HullRequestFull,
    res: $Response,
    next: NextFunction
  ) {
    const callbackResult = callback(req.hull);
    debug("callbackResult", typeof callbackResult);

    if (fireAndForget === true) {
      callbackResult.catch(error => {
        // all TransientErrors (and child error classes such as ConfigurationError)
        if (error instanceof TransientError) {
          debug("transient-error metric");
          req.hull.metric.increment("connector.transient_error", 1, [
            `error_name:${_.snakeCase(error.name)}`,
            `error_message:${_.snakeCase(error.message)}`
          ]);
        } else {
          req.hull.metric.captureException(error);
        }
      });
      return res.json({ status: "deferred" });
    }
    return callbackResult
      .then(response => {
        res.json(response);
      })
      .catch(error => next(error));
  });
  router.use(instrumentationTransientErrorMiddleware());
  if (disableErrorHandling === true) {
    router.use(
      (
        err: Error,
        req: HullRequestFull,
        res: $Response,
        next: NextFunction
      ) => {
        debug("error", err);
        // if we have transient error
        if (err instanceof TransientError) {
          return res.status(503).end("transient-error");
        }
        // else pass it to the global error middleware
        return next(err);
      }
    );
  }
  return router;
}

module.exports = scheduleHandlerFactory;

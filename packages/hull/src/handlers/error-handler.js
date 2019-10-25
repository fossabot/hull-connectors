// @flow
import type { NextFunction } from "express";
import type {
  HullRequest,
  HullIncomingHandlerOptions,
  HullResponse
} from "../types";
import {
  TransientError,
  ConnectorNotFoundError,
  PaymentRequiredError
} from "../errors";

const debug = require("debug")("hull-connector:error-handler");

const errorHandler = ({ respondWithError }: HullIncomingHandlerOptions) => (
  err: Error,
  req: HullRequest,
  res: HullResponse,
  next: NextFunction
) => {
  const { metric } = req.hull;
  debug("error", err.message, err.constructor.name, { respondWithError });

  // How do we want to respond?  With json?
  res.json({ error: respondWithError ? err.toString() : true });

  // if we have a transient error
  if (err instanceof TransientError) {
    res.status(503);
    return res.end("transient-error");
  }
  if (err instanceof ConnectorNotFoundError) {
    res.status(404);
    return res.end("not-found");
  }
  if (err instanceof PaymentRequiredError) {
    res.status(402);
    return res.end("payment-required");
  }

  metric.captureException(err);

  // if we have non transient error
  // pass it to the global error middleware
  return next(err);
};

export default errorHandler;

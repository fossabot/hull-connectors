// @flow
import type { $Response, NextFunction } from "express";
import type {
  HullRequestFull,
  HullNotificationHandlerConfiguration
} from "../../types";

const debug = require("debug")("hull-connector:notification-handler");

const {
  notificationDefaultFlowControl,
  trimTraitsPrefixFromUserMessage
} = require("../../utils");

function notificationHandlerProcessingMiddlewareFactory(
  notificationHandlersConfiguration: HullNotificationHandlerConfiguration
) {
  return function notificationHandlerProcessingMiddleware(
    req: HullRequestFull,
    res: $Response,
    next: NextFunction
  ): mixed {
    if (!req.hull.notification) {
      return next(new Error("Missing Notification payload"));
    }
    const { channel } = req.hull.notification;
    let { messages } = req.hull.notification;
    debug("notification", {
      channel,
      messages: Array.isArray(messages) && messages.length
    });
    if (notificationHandlersConfiguration[channel] === undefined) {
      return next(new Error("Channel unsupported"));
    }
    const { callback } = notificationHandlersConfiguration[channel];

    if (channel === "user:update") {
      messages = messages.map(trimTraitsPrefixFromUserMessage);
    }

    const defaultSuccessFlowControl = notificationDefaultFlowControl(
      req.hull,
      channel,
      "success"
    );
    req.hull.notificationResponse = {
      flow_control: defaultSuccessFlowControl
    };
    // $FlowFixMe
    return callback(req.hull, messages)
      .then(() => {
        res.status(200).json(req.hull.notificationResponse);
      })
      .catch(error => next(error));
  };
}

module.exports = notificationHandlerProcessingMiddlewareFactory;

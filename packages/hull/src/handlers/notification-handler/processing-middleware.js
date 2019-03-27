// @flow
import type { NextFunction } from "express";
import type {
  HullRequest,
  HullNotificationHandlerConfiguration,
  HullNotificationResponse,
  HullResponse
} from "../../types";

const debug = require("debug")("hull-connector:notification-handler");

const {
  notificationDefaultFlowControl,
  trimTraitsPrefixFromUserMessage
} = require("../../utils");

function notificationHandlerProcessingMiddlewareFactory(
  configuration: HullNotificationHandlerConfiguration
) {
  return async function notificationHandlerProcessingMiddleware(
    req: HullRequest,
    res: HullResponse,
    next: NextFunction
  ): mixed {
    if (!req.hull.notification) {
      return next(new Error("Missing Notification payload"));
    }
    const { channel } = req.hull.notification;
    let { messages = [] } = req.hull.notification;
    debug("notification", {
      channel,
      messages: Array.isArray(messages) && messages.length
    });
    const handler = configuration[channel];
    if (handler === undefined) {
      debug("channel unsupported", channel);
      return next(new Error("Channel unsupported"));
    }
    const { callback } = handler;

    if (channel === "user:update") {
      // $FlowFixMe
      messages = messages.map(trimTraitsPrefixFromUserMessage);
    }

    const defaultSuccessFlowControl = notificationDefaultFlowControl(
      req.hull,
      channel,
      "success"
    );
    // req.hull.notificationResponse = notificationResponse
    try {
      // $FlowFixMe
      const nResponse: HullNotificationResponse = await callback(
        req.hull,
        // $FlowFixMe
        messages
      );
      const { flow_control = defaultSuccessFlowControl } = nResponse || {};
      return res.status(200).json({ flow_control });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = notificationHandlerProcessingMiddlewareFactory;

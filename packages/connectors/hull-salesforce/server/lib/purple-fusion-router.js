/* @flow */
import type { HullContext } from "hull/src/types/context";

const _ = require("lodash");

const HullRouter = require("hull-connector-framework/src/purplefusion/router");
const {
  hullService
} = require("hull-connector-framework/src/purplefusion/hull-service");
const glue = require("../purplefusion/glue");
const eventsService = require("../purplefusion/service");
const salesforceService = require("../purplefusion/salesforce-service");

const services = {
  salesforce: eventsService,
  hull: hullService,
  salesforce_service: salesforceService
};
const transforms = _.concat(
  [],
  require("../purplefusion/transforms-to-service"),
  require("../purplefusion/transforms-to-hull")
);

const ensureHook = "ensureHook";

class PurpleFusionRouter {
  hullRouter: HullRouter;

  route: string;

  constructor(route?: string) {
    this.route = route;

    this.hullRouter = new HullRouter({
      glue,
      services,
      transforms,
      ensureHook
    });
  }

  // TODO deprecate
  async invokeRoute(ctx: HullContext, data: Object) {
    return this.invokeIncomingRoute(ctx, data);
  }

  async invokeIncomingRoute(ctx: HullContext, data: Object) {
    const endpoint = {
      handler: this.route
    };
    return this.hullRouter.createIncomingDispatchCallback(endpoint)(ctx, data);
  }

  async invokeOutgoingRoute(
    ctx: HullContext,
    messages: Array<Object>,
    route?: string
  ) {
    if (_.isEmpty(messages)) {
      return Promise.resolve({});
    }
    const endpoint = {
      handler: _.isNil(route) ? this.route : route
    };
    return this.hullRouter.createOutgoingDispatchCallback(endpoint)(
      ctx,
      messages
    );
  }
}

module.exports = PurpleFusionRouter;

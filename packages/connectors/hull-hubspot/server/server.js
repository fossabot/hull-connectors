// @flow
import type { $Application } from "express";

const cors = require("cors");
const {
  jsonHandler,
  scheduleHandler,
  notificationHandler,
  batchHandler
} = require("hull/src/handlers");

const notificationsConfiguration = require("./notifications-configuration");

const actions = require("./actions");

function server(app: $Application): $Application {
  const deps = {
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    hostSecret: process.env.SECRET
  };

  app.use("/fetch-all", jsonHandler(actions.fetchAll)); // old name - to be removed
  app.use("/fetch-all-contacts", jsonHandler(actions.fetchAll));

  app.use(
    "/sync",
    scheduleHandler({
      callback: actions.fetch,
      options: {
        fireAndForget: true
      }
    })
  ); // old name - to be removed
  app.use(
    "/fetch-recent-contacts",
    scheduleHandler({
      callback: actions.fetch,
      options: {
        fireAndForget: true
      }
    })
  );

  app.use("/fetch-all-companies", jsonHandler(actions.fetchAllCompanies));
  app.use(
    "/fetch-recent-companies",
    scheduleHandler({
      callback: actions.fetchRecentCompanies,
      options: {
        fireAndForget: true
      }
    })
  );

  app.use("/batch", batchHandler(notificationsConfiguration));
  app.use("/batch-accounts", batchHandler(notificationsConfiguration));

  app.use("/smart-notifier", notificationHandler(notificationsConfiguration));

  app.use(
    "/monitor/checkToken",
    scheduleHandler({
      callback: actions.checkToken,
      options: {
        fireAndForget: true
      }
    })
  );

  app.use(
    "/schema/contact_properties",
    cors(),
    jsonHandler({
      callback: actions.getContactProperties,
      options: { respondWithError: true }
    })
  );

  app.use(
    "/schema/incoming_user_claims",
    cors(),
    jsonHandler({
      callback: actions.getIncomingUserClaims,
      options: { respondWithError: false }
    })
  );

  app.use(
    "/schema/incoming_account_claims",
    cors(),
    jsonHandler({
      callback: actions.getIncomingAccountClaims,
      options: { respondWithError: false }
    })
  );

  app.use(
    "/schema/company_properties",
    cors(),
    jsonHandler(actions.getCompanyProperties)
  );

  app.use("/status", scheduleHandler(actions.statusCheck));

  app.use("/auth", actions.oauth(deps));

  return app;
}

module.exports = server;

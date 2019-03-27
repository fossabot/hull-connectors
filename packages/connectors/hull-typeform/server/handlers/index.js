// @flow
import type { HullHandlersConfiguration } from "hull";
import {
  authorization,
  refreshAccessToken,
  fetchAllResponses,
  fetchRecentResponses,
  getForms,
  getEmailQuestions,
  getQuestions
} from "../actions";

const handlers: HullHandlersConfiguration = {
  external: [
    {
      url: "/fetch-all-responses",
      handler: {
        callback: fetchAllResponses
      }
    },
    {
      url: "/schema/forms",
      handler: {
        callback: getForms
      }
    },
    {
      url: "/schema/fields/email",
      handler: {
        callback: getEmailQuestions
      }
    },
    {
      url: "/schema/fields",
      handler: {
        callback: getQuestions
      }
    },
    {
      url: "/refresh-access-token",
      handler: {
        callback: refreshAccessToken,
        options: {
          fireAndForget: true
        }
      }
    },
    {
      url: "/fetch",
      handler: {
        callback: fetchRecentResponses,
        options: {
          fireAndForget: true
        }
      }
    },
    {
      url: "/fetch-recent-responses",
      handler: {
        callback: fetchRecentResponses,
        options: {
          fireAndForget: true
        }
      }
    },
    {
      url: "/admin",
      method: "all",
      handler: authorization
    }
  ]
  // ,
  // json: [
  // ],
  // schedules: [
  // ],
  // routers: [
  // ]
};

export default handlers;

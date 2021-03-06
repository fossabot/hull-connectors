import type { RawRestApi } from "hull-connector-framework/src/purplefusion/types";
import { SuperagentApi } from "hull-connector-framework/src/purplefusion/superagent-api";

const {
  ConfigurationError,
  SkippableError
} = require("hull/src/errors");

const OAuth2Strategy = require("passport-oauth2");

const { notNull } = require("hull-connector-framework/src/purplefusion/conditionals");
const MESSAGES = require("./messages");

const service = ({clientID, clientSecret}: {
  clientId: string,
  clientSecret: string
}) : RawRestApi => ({
  initialize: (context, api) => new SuperagentApi(context, api),
  prefix: "https://bigquery.googleapis.com/bigquery/v2",
  defaultReturnObj: "body",
  superagent: {
    settings: [
      { method: "set", params: { "Content-Type": "application/json" }},
      { method: "set", params: { Authorization: "Bearer ${connector.private_settings.access_token}" }}
    ]
  },
  endpoints: {
    getProjects: {
      url: "/projects",
      operation: "get",
      returnObj: "body.projects"
    },
    refreshToken: {
      url: "https://oauth2.googleapis.com/token",
      operation: "post",
      endpointType: "create"
    },
    insertQueryJob: {
      url: "/projects/${projectId}/jobs",
      operation: "post"
    },
    getJob: {
      url: "/projects/${projectId}/jobs/${jobId}",
      operation: "get",
    },
    getJobResults: {
      url: "/projects/${projectId}/queries/${jobId}?maxResults=1000&pageToken=${pageToken}",
      operation: "get"
    }
  },
  authentication: {
    strategy: "oauth2",
    params: {
      Strategy: OAuth2Strategy,
      clientID,
      clientSecret
    }
  },
  error: {
    parser: {
      httpStatus: "status",
      parser: {
        type: "json",
        target: "response.text",
        title: "errors[0].reason",
        description: "errors[0].message",
      }
    },
    templates: [
      {
        truthy: { status: 401 },
        condition: notNull("connector.private_settings.access_token"),
        errorType: ConfigurationError,
        message: MESSAGES.STATUS_UNAUTHORIZED_REFRESH_TOKEN,
        recoveryroute: "refreshToken",
      },
      {
        truthy: { status: 404 },
        errorType: SkippableError,
        message: MESSAGES.GOOGLE_ENTITY_NOT_FOUND
      }
    ]
  }
});

module.exports = service;

// @flow
/* global describe, it, beforeEach, afterEach */
const testScenario = require("hull-connector-framework/src/test-scenario");
const connectorServer = require("../../../server/server");

process.env.OVERRIDE_HUBSPOT_URL = "";

const connector = {
  private_settings: {
  }
};
const usersSegments = [
  {
    name: "testSegment",
    id: "hullSegmentId"
  }
];

it("should not attempt to work if the token is missing", () => {
  const email = "email@email.com";
  return testScenario({ connectorServer }, ({ handlers, nock, expect }) => {
    return {
      handlerType: handlers.notificationHandler,
      handlerUrl: "smart-notifier",
      channel: "user:update",
      externalApiMock: () => {
        const scope = nock("https://api.hubapi.com");
        return scope;
      },
      connector,
      usersSegments,
      accountsSegments: [],
      messages: [
        {
          user: {
            email
          },
          segments: [{ id: "hullSegmentId", name: "hullSegmentName" }]
        }
      ],
      response: {
        flow_control: {
          in: 5,
          in_time: 10,
          size: 10,
          type: "next"
        }
      },
      logs: [
        ["error", "connector.configuration.error", expect.whatever(), { errors: "connector is not configured" }]
      ],
      firehoseEvents: [],
      metrics: [
        ["increment", "connector.request", 1]
      ],
      platformApiCalls: []
    };
  });
});

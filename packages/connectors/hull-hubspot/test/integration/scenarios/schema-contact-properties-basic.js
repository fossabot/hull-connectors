// @flow
declare function describe(name: string, callback: Function): void;
declare function before(callback: Function): void;
declare function beforeEach(callback: Function): void;
declare function afterEach(callback: Function): void;
declare function it(name: string, callback: Function): void;
declare function test(name: string, callback: Function): void;


const testScenario = require("hull-connector-framework/src/test-scenario");
import connectorConfig from "../../../server/config";


process.env.OVERRIDE_HUBSPOT_URL = "";

const connector = {
  private_settings: {
    token: "hubToken"
  }
};

it("should send out a new hull account to hubspot", () => {
  const domain = "hull.io";
  return testScenario({ connectorConfig }, ({ handlers, nock, expect }) => {
    return {
      handlerType: handlers.jsonHandler,
      handlerUrl: "schema/contact_properties",
      externalApiMock: () => {
        const scope = nock("https://api.hubapi.com");
        scope.get("/contacts/v2/groups?includeProperties=true")
          .reply(200, [{
            displayName: "display",
            properties: [
              {
                label: "coke",
                name: "shortName"
              }
            ]
          }]);
        return scope;
      },
      connector,
      usersSegments: [],
      accountsSegments: [],
      response: {
        options: [{
          label: "display",
          options: [{
            label: "coke",
            value: "shortName",
          }],
        }]
      },
      logs: [
        ["debug", "connector.service_api.call", expect.whatever(), expect.objectContaining({ "method": "GET", "status": 200, "url": "/contacts/v2/groups" })]
      ],
      firehoseEvents: [],
      metrics: [
        ["increment", "connector.request", 1],
        ["increment", "ship.service_api.call", 1],
        ["value", "connector.service_api.response_time", expect.any(Number)]
      ],
      platformApiCalls: [
        ["GET", "/api/v1/app", {}, {}],
        ["GET", "/api/v1/users_segments?shipId=9993743b22d60dd829001999", expect.whatever(), {}],
        ["GET", "/api/v1/accounts_segments?shipId=9993743b22d60dd829001999", expect.whatever(), {}]
      ]
    };
  });
});

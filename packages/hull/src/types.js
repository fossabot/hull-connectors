// @flow
/* eslint-disable no-use-before-define */
/* :: export type * from "hull-client"; */

import type { Middleware, $Application } from "express";
import type {
  HullSegment,
  HullAccountSegment,
  HullUserSegment,
  HullUser,
  HullEvent,
  HullAccount,
  HullClientConfig,
  HullAttributeName,
  HullAttributeValue
} from "hull-client";

import type { Connector as ConnectorEngine } from "./index";
import type Cache from "./infra/cache/cache-agent";
import type Queue from "./infra/queue/queue-agent";
import type Worker from "./connector/worker";
import type Instrumentation from "./infra/instrumentation/instrumentation-agent";
import { incomingClaims, settingsUpdate, extractRequest } from "./helpers";

export type * from "hull-client";
const Client = require("hull-client");

const ConnectorCache = require("./infra/cache/connector-cache");
const MetricAgent = require("./infra/instrumentation/metric-agent");

export type HullFramework = {|
  Client: Client,
  Connector: Class<ConnectorEngine>
|};
export type HullCache = Cache;
export type HullQueue = Queue;
export type HullWorker = Worker;
export type HullInstrumentation = Instrumentation;
export type HullClient = Client;

// IMPORTANT: FOR SPREAD SYNTAX:
// https://github.com/facebook/flow/issues/3534#issuecomment-287580240
// You need to use {...$Exact<Type>} if you want to avoid
// making every field in Type optional

// ====================================
// Manifest Data types
// ====================================
export type HullConnectorSettings = {
  [HullConnectorSettingName: string]: any
};

type HullManifestSetting = {
  [string]: any
};

type HullNotificationHandlerChannel = {
  callback: string,
  options: HullNotificationHandlerOptions
};

// A Manifest Notification block. Defines a route for Hull to send Notifications to.
type HullManifestNotification = {
  url: string,
  channels: {
    [channelName: string]: HullNotificationHandlerChannel
  }
};

// A Manifest Batch block. Defines a route for Hull to send Notifications to.
type HullManifestBatch = {
  url: string,
  channels: {
    [channelName: string]: HullNotificationHandlerChannel
  }
};

// A Manifest Schedule block. Defines a schedule for Hull to ping the connector
type HullManifestSchedule = {
  url: string,
  handler: string,
  interval: string,
  options?: HullSchedulerHandlerOptions
};

// A Manifest Endpoint block. Defines a publicly-available route for the Connector to receive Service data
type HTTPMethod =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE";
type HullManifestEndpoint = {
  url: string,
  handler: string,
  method: HTTPMethod,
  options?: HullIncomingHandlerOptions
};

// A Manifest Tab config. Defines a route to display a screen in the Dashboard
type HullManifestTabConfig = {
  title: string,
  url: string,
  handler: {
    callback: string,
    options?: HullIncomingHandlerOptions
  },
  size: "small" | "large",
  editable: boolean
};

// Connector Manifest. Defines a Connector's exposed endpoints and features
export type HullManifest = {
  name: string,
  description: string,
  tags: Array<"batch" | "batch-accounts" | "kraken">,
  source: string,
  logo: string,
  picture: string,
  readme: string,
  version: string,
  tabs: Array<HullManifestTabConfig>,
  schedules?: Array<HullManifestSchedule>,
  status?: Array<HullManifestSchedule>,
  subscriptions?: Array<HullManifestNotification>,
  batch?: Array<HullManifestBatch>,
  endpoints?: Array<HullManifestEndpoint>,
  deployment_settings: Array<HullManifestSetting>,
  settings?: Array<HullManifestSetting>,
  private_settings?: Array<HullManifestSetting>
};

// =====================================
// Hull Connector Instance Object
// =====================================
export type HullConnector = {
  id: string,
  updated_at: string,
  created_at: string,
  name: string,
  description: string,
  tags: Array<string>,
  source_url: string,
  index: string,
  picture: string,
  homepage_url: string,
  manifest_url: string,
  manifest: HullManifest,
  settings: HullConnectorSettings,
  private_settings: HullConnectorSettings,
  status: Object
};

// =====================================
//    Connector Data Types
// =====================================

export type HullMetric =
  | ["value", string, number, Array<string>]
  | ["increment", string, number, Array<string>];

// =====================================
//   Connector Configuration
// =====================================

export type HullJsonConfig = {
  inflate?: boolean,
  reviver?: Function,
  limit?: string,
  strict?: boolean,
  type?: string | Function,
  verify?: Function
};
export type HullServerConfig = {
  start?: boolean
};
export type HullWorkerConfig = {
  start?: boolean,
  queueName?: string | null
};
export type HullMetricsConfig = {
  captureMetrics?: Array<HullMetric>,
  exitOnError?: boolean
};
export type HullLogsConfig = {
  logLevel?: ?string
};
export type HullConnectorConfig = {
  clientConfig: HullClientConfig,
  serverConfig?: HullServerConfig,
  workerConfig?: HullWorkerConfig,
  metricsConfig?: HullMetricsConfig,
  logsConfig?: HullLogsConfig,
  hostSecret: string,
  port: number | string,
  connectorName?: string,
  segmentFilterSetting?: any,
  skipSignatureValidation?: boolean,
  timeout?: number | string,
  disableOnExit?: boolean,
  devMode?: boolean,
  json?: HullJsonConfig,
  instrumentation?: Instrumentation,
  cache?: Cache,
  queue?: Queue,
  handlers:
    | HullHandlersConfiguration
    | (HullConnector => HullHandlersConfiguration),
  notificationValidatorHttpClient?: Object,
  middlewares: Array<Middleware>,
  manifest: HullManifest
  // $FlowFixMe
  // handlers: HullHandlers // eslint-disable-line no-use-before-define
};
export type HullCacheConfig = {
  ttl?: number,
  max?: number,
  store?: string
};
export type HullClientCredentials = {
  id: string,
  secret: string,
  organization: string
};

// =====================================
//   Hull Context
// =====================================

export type HullContextBase = {
  requestId?: string, // request id
  hostname: string, // req.hostname
  options: Object, // req.query
  isBatch: boolean,
  HullClient: Class<Client>,

  connectorConfig: HullConnectorConfig, // configuration passed to Hull.Connector
  clientConfig: HullClientConfig, // configuration which will be applied to Hull Client

  cache: ConnectorCache,
  metric: MetricAgent,
  enqueue: (
    // queueAdapter: Object,
    // // eslint-disable-next-line no-use-before-define
    // ctx: HullContext,
    jobName: string,
    jobPayload?: Object,
    options?: Object
  ) => Promise<*>,

  token?: string,
  clientCredentials?: HullClientCredentials, // HullClient credentials
  clientCredentialsToken?: string // encrypted token with HullClient credentials
};
export type HullContext = {
  /**
   * Context added to the express app request by hull-node connector sdk.
   * Accessible via `req.hull` param.
   * @public
   * @memberof Types
   */
  ...$Exact<HullContextBase>,
  handlerName?: string,
  clientCredentials: HullClientCredentials, // HullClient configuration
  // clientCredentialsToken?: string,
  clientCredentialsToken: string,
  // connector?: HullConnector,
  connector: HullConnector,
  // usersSegments?: Array<HullSegment>,
  // accountsSegments?: Array<HullSegment>
  usersSegments: Array<HullUserSegment>,
  accountsSegments: Array<HullAccountSegment>,
  client: Client,
  notification?: HullNotification,
  connector: HullConnector,
  authParams?: {},
  helpers: {
    settingsUpdate: $Call<typeof settingsUpdate, HullContext>,
    incomingClaims: $Call<typeof incomingClaims, HullContext>,
    extractRequest: $Call<typeof extractRequest, HullContext>
  }
};

// =====================================
//   Handlers Requests
// =====================================

// Should disappear in the future to be replaced with a unified ctx, message signature
declare class $HullRequest extends express$Request {
  /*
  * Since Hull Middleware adds new parameter to the Request object from express application
  * we are providing an extended type to allow using HullReqContext
  * @public
  * @memberof Types
  */
  hull: HullContext;
}
export type HullRequest = $HullRequest;
export type HullOAuthRequest = HullRequest & {
  account?: {
    refreshToken?: string,
    accessToken?: string,
    [string]: any
  },
  authParams?: {}
};

// Hull Notification
// declare class $NotificationBody {
//   body: HullNotification;
// }
// declare class $HullNotificationRequest extends $HullRequest
//   mixins $NotificationBody {}
// export type HullNotificationRequest = $HullNotificationRequest;

// === External Handler request. for use in (ctx, message: HullIncomingHandlerMessage) signatures
type HandlerMap = { [string]: any };
export type HullIncomingHandlerMessage = {|
  ip: string,
  url: string,
  method: string,
  protocol: string,
  hostname: string,
  path: string,
  params: HandlerMap,
  query: HandlerMap,
  headers: HandlerMap,
  cookies: HandlerMap,
  body?: {}
|};

// =====================================
//   Handler Responses
// =====================================

// Should disappear in the future to be replaced with a function return instead.
// declare class $HullResponse extends express$Response {}
export type HullResponse = express$Response;

// === Notification Handler response
export type HullNotificationFlowControl = {
  type: "next" | "retry",
  size?: number,
  in?: number,
  in_time?: number
};
export type HullMessageResponse = {|
  action: "success" | "skip" | "error",
  type: "user" | "account" | "event",
  message_id?: string,
  message?: string,
  id: ?string,
  data: {}
|};

// TODO: Make this strict
export type HullNotificationResponseData = void | {
  flow_control?: HullNotificationFlowControl,
  responses?: Array<?HullMessageResponse>
};
export type HullNotificationResponse = HullNotificationResponseData | Promise<HullNotificationResponseData>;

export type HullExternalResponseData = {
  status?: number,
  pageLocation?: string,
  data?: any,
  text?: string
};
export type HullExternalResponse =
  | void
  | HullExternalResponseData
  | Promise<void | HullExternalResponseData>;
export type HullStatusResponseData =
  | {
      status: "ok" | "warning" | "error",
      messages: Array<string>
    }
  | {
      status: "ok" | "warning" | "error",
      message: string
    };

export type HullStatusResponse =
  | HullStatusResponseData
  | Promise<HullStatusResponseData>;

// ====================================
//   Notification DataTypes
// ====================================
/**
 * Attributes (traits) changes is an object map where keys are attribute (trait) names and value is an array
 * where first element is an old value and second element is the new value.
 * This object contain information about changes on one or multiple attributes (that's thy attributes and changes are plural).
 */
export type HullAttributesChanges = {|
  [HullAttributeName]: [HullAttributeValue, HullAttributeValue]
|};

/**
 * Represents segment changes in TUserChanges.
 * The object contains two params which mark which segments user left or entered.
 * It may contain none, one or multiple HullSegment in both params.
 */
export type HullSegmentsChanges = {
  entered?: Array<HullSegment>,
  left?: Array<HullSegment>
};

/**
 * Object containing all changes related to User in HullUserUpdateMessage
 */
export type HullUserChanges = {
  is_new: boolean,
  user: HullAttributesChanges,
  account: HullAttributesChanges,
  segment_ids: Array<string>,
  segments: HullSegmentsChanges, // should be segments or user_segments?
  account_segments: HullSegmentsChanges, // should be segments or user_segments?
  account_segment_ids?: Array<string>
};

/**
 * Object containing all changes related to Account in HullUserUpdateMessage
 */
export type HullAccountChanges = {
  is_new: boolean,
  account: HullAttributesChanges,
  account_segments: HullSegmentsChanges, // should be segments or user_segments?
  account_segment_ids?: Array<string>
};

/**
 * A message sent by the platform when any event, attribute (trait) or segment change happens on the user.
 */
export type HullUserUpdateMessage = {
  message_id: string,
  user: HullUser,
  changes: HullUserChanges,
  segments: Array<HullUserSegment>,
  account_segments: Array<HullAccountSegment>,
  events: Array<HullEvent>,
  account: HullAccount
};
export type HullUserDeleteMessage = {};

/**
 * A message sent by the platform when any attribute (trait) or segment change happens on the account.
 */
export type HullAccountUpdateMessage = {
  changes: HullAccountChanges,
  account_segments: Array<HullAccountSegment>,
  account: HullAccount,
  message_id: string
};
export type HullAccountDeleteMessage = {};

/**
 * A message sent by the platform when a Segment is updated
 */
export type HullSegmentUpdateMessage = {
  id: string,
  name: string,
  created_at: string,
  updated_at: string,
  message_id: string
};
export type HullUserSegmentUpdateMessage = HullSegmentUpdateMessage & {
  type: "users_segment"
};
export type HullAccountSegmentUpdateMessage = HullSegmentUpdateMessage & {
  type: "accounts_segment"
};
export type HullUserSegmentDeleteMessage = HullSegmentUpdateMessage & {
  type: "users_segment"
};
export type HullAccountSegmentDeleteMessage = HullSegmentUpdateMessage & {
  type: "accounts_segment"
};
export type HullSegmentDeleteMessage = {
  id: string,
  name: string,
  type: "users_segment" | "accounts_segment",
  created_at: string,
  updated_at: string
};

/**
 * A message sent by the platform when a Segment is updated
 */
export type HullConnectorUpdateMessage = {
  ...$Exact<HullConnector>,
  secret: string
};
export type HullConnectorDeleteMessage = {
  ...$Exact<HullConnector>,
  secret: string
};

/**
 * The whole notification object
 */
export type HullNotification = {
  configuration: {
    id: string,
    secret: string,
    organization: string
  },
  channel: string,
  connector: HullConnector,
  segments: Array<HullUserSegment>,
  accounts_segments: Array<HullAccountSegment>,
  messages?: Array<HullUserUpdateMessage | HullAccountUpdateMessage>,
  notification_id: string
};

// ====================================
//   Handler functions
// ====================================
export type HullUserUpdateCallback = (
  ctx: HullContext,
  messages: Array<HullUserUpdateMessage>
) => HullNotificationResponse;
export type HullUserDeleteCallback = (
  ctx: HullContext,
  messages: Array<HullUserDeleteMessage>
) => HullNotificationResponse;
export type HullAccountUpdateCallback = (
  ctx: HullContext,
  messages: Array<HullAccountUpdateMessage>
) => HullNotificationResponse;
export type HullAccountDeleteCallback = (
  ctx: HullContext,
  messages: Array<HullAccountDeleteMessage>
) => HullNotificationResponse;
export type HullSegmentUpdateCallback<T> = (
  ctx: HullContext,
  messages: Array<T>
) => HullNotificationResponse;
export type HullSegmentDeleteCallback<T> = (
  ctx: HullContext,
  messages: Array<T>
) => HullNotificationResponse;
export type HullConnectorUpdateCallback = (
  ctx: HullContext,
  messages?: HullConnectorUpdateMessage
) => HullNotificationResponse;

export type HullNotificationHandlerCallback =
  | HullConnectorUpdateCallback
  | HullUserUpdateCallback
  | HullUserDeleteCallback
  | HullAccountUpdateCallback
  | HullAccountDeleteCallback
  | HullSegmentUpdateCallback<HullUserSegment>
  | HullSegmentUpdateCallback<HullAccountSegment>
  | HullSegmentDeleteCallback<HullUserSegment>
  | HullSegmentDeleteCallback<HullAccountSegment>;

// ====================================
//   Notification Handler Configuration
// ====================================
export type HullNotificationHandlerOptions = {
  disableErrorHandling?: boolean,
  maxTime?: number,
  maxSize?: number
};
export type Handler<HNC, HNO> = {
  callback: HNC,
  options?: HNO
};
export type HullNotificationHandlerConfiguration = {|
  "user:update"?: Handler<
    HullUserUpdateCallback,
    HullNotificationHandlerOptions
  >,
  "user:delete"?: Handler<
    HullUserDeleteCallback,
    HullNotificationHandlerOptions
  >,
  "account:update"?: Handler<
    HullAccountUpdateCallback,
    HullNotificationHandlerOptions
  >,
  "users_segment:update"?: Handler<
    HullSegmentUpdateCallback<HullUserSegmentUpdateMessage>,
    HullNotificationHandlerOptions
  >,
  "users_segment:delete"?: Handler<
    HullSegmentDeleteCallback<HullUserSegmentUpdateMessage>,
    HullNotificationHandlerOptions
  >,
  "accounts_segment:update"?: Handler<
    HullSegmentUpdateCallback<HullAccountSegmentUpdateMessage>,
    HullNotificationHandlerOptions
  >,
  "accounts_segment:delete"?: Handler<
    HullSegmentDeleteCallback<HullAccountSegmentUpdateMessage>,
    HullNotificationHandlerOptions
  >,
  "ship:update"?: Handler<
    HullConnectorUpdateCallback,
    HullNotificationHandlerOptions
  >
  // ,
  // [HullChannelName: string]: Handler<
  //   HullNotificationHandlerCallback,
  //   HullNotificationHandlerOptions
  // >
|};

// TODO: evolve this introducing envelope etc.
export type HullSendResponse = Promise<*>;
export type HullSyncResponse = Promise<*>;
export type HandlerCacheOptions = {
  key?: string,
  options?: Object
};

// ====================================
//   Batch Handler Configuration
// ====================================
export type HullBatchHandlerOptions = {
  maxSize?: number
};
// Same signature for now
export type HullBatchHandlerCallback = HullNotificationHandlerCallback;
export type HullBatchHandlersConfigurationEntry = Handler<
  HullBatchHandlerCallback,
  HullBatchHandlerOptions
>;
export type HullBatchHandlersConfiguration = {
  [HullChannelName: string]: HullBatchHandlersConfigurationEntry
};

// ====================================
//   Status Handler Configuration
// ====================================
export type HullStatusHandlerOptions = HullIncomingHandlerOptions & {};
export type HullStatusHandlerCallback = (
  ctx: HullContext
) => HullStatusResponse;
export type HullStatusHandlerConfigurationEntry = Handler<
  HullStatusHandlerCallback,
  HullStatusHandlerOptions
>;
export type HullStatusHandlersConfiguration = {
  [HullChannelName: string]: HullStatusHandlerConfigurationEntry
};

// ====================================
//   Incoming request handlers - everything that doesn't come from Kraken or Batch
// ====================================
export type HullIncomingHandlerOptions = {
  // fetchShip?: boolean,
  // cacheShip?: boolean,
  cache?: HandlerCacheOptions,
  respondWithError?: boolean,
  disableErrorHandling?: boolean,
  fireAndForget?: boolean,
  credentialsFromQuery?: boolean,
  credentialsFromNotification?: boolean,
  strict?: boolean,
  format?: "json" | "html",
  bodyParser?: "urlencoded" | "json"
};

export type HullIncomingHandlerCallback = (
  ctx: HullContext,
  message: HullIncomingHandlerMessage,
  res: HullResponse
) => HullExternalResponse;
export type HullIncomingHandlerConfigurationEntry = Handler<
  HullIncomingHandlerCallback,
  HullIncomingHandlerOptions
>;

// ====================================
//   Schedule Handler Configuration
// ====================================
export type HullSchedulerHandlerOptions = HullIncomingHandlerOptions & {};
export type HullSchedulerHandlerCallback = HullIncomingHandlerCallback;
export type HullSchedulerHandlerConfigurationEntry = Handler<
  HullSchedulerHandlerCallback,
  HullSchedulerHandlerOptions
>;

// ====================================
//   Incoming Handler Configuration
// ====================================
//
// export type HullIncomingHandlerOptions = HullIncomingHandlerOptions & {};
// export type HullIncomingHandlerCallback = (
//   ctx: HullContext,
//   message: HullIncomingHandlerMessage,
//   res: HullResponse
// ) => Promise<void | HullExternalResponse>;
// export type HullIncomingHandlerConfigurationEntry = Handler<
//   HullIncomingHandlerCallback,
//   HullIncomingHandlerOptions
// >;
// export type HullIncomingHandlerConfiguration = {
//   [name: string]: HullHtmlHandlerConfigurationEntry
// };

// ====================================
//   HTML Handler Configuration
// ====================================

export type HullHtmlHandlerOptions = HullIncomingHandlerOptions & {};
export type HullHtmlHandlerCallback = HullIncomingHandlerCallback;
export type HullHtmlHandlerConfigurationEntry = Handler<
  HullHtmlHandlerCallback,
  HullHtmlHandlerOptions
>;

// ====================================
//   JSON Handler Configuration
// ====================================
export type HullJsonHandlerOptions = HullIncomingHandlerOptions & {};
export type HullJsonHandlerCallback = HullIncomingHandlerCallback;
export type HullJsonHandlerConfigurationEntry = Handler<
  HullJsonHandlerCallback,
  HullJsonHandlerOptions
>;
export type HullJsonHandlerConfiguration = {
  [name: string]: HullJsonHandlerConfigurationEntry
};

// =====================================
//   Middleware params types
// =====================================

export type HullBaseMiddlewareParams = {
  Client: Class<Client>,
  queue: Queue,
  cache: Cache,
  instrumentation: Instrumentation,
  connectorConfig: HullConnectorConfig
};
export type HullContextMiddlewareParams = {
  requestName?: string,
  type?: "notification" | "query"
};

// ============================
// OOP types
// ============================
export interface HullSyncAgent {
  constructor(ctx: HullContext): void;
  sendUserUpdateMessages(
    messages: Array<HullUserUpdateMessage>
  ): HullSendResponse;
  sendAccountUpdateMessages(
    messages: Array<HullAccountUpdateMessage>
  ): HullSendResponse;
  syncConnectorUpdateMessage(): HullSyncResponse;
  syncSegmentUpdateMessage(): HullSyncResponse;
}
export type HullServerFunction = (
  app: $Application,
  extra?: Object
) => $Application;

/* Configurable Claims */

export type HullConnectorSettingsTraitMapping = Array<{
  hull?: string,
  service?: string,
  name?: string,
  overwrite?: boolean
}>;

export type HullIncomingClaimsSetting = {
  hull?: string,
  service?: string,
  required?: boolean
};

export type HullHandlersConfiguration = {
  notifications?: Array<{
    url: string,
    handlers: HullNotificationHandlerConfiguration
  }>,
  batches?: Array<{
    url: string,
    handlers: HullBatchHandlersConfiguration
  }>,
  json?: Array<{
    url: string,
    method?: HTTPMethod,
    handler: HullJsonHandlerConfigurationEntry
  }>,
  statuses?: Array<{
    url: string,
    method?: HTTPMethod,
    handler: HullStatusHandlerConfigurationEntry
  }>,
  schedules?: Array<{
    url: string,
    method?: HTTPMethod,
    handler: HullSchedulerHandlerConfigurationEntry
  }>,
  incoming?: Array<{
    url: string,
    method?: HTTPMethod,
    handler: HullIncomingHandlerConfigurationEntry
  }>,
  html?: Array<{
    url: string,
    method?: HTTPMethod,
    handler: HullHtmlHandlerConfigurationEntry
  }>,
  routers?: Array<{
    url: string,
    handler: express$Middleware
  }>
};

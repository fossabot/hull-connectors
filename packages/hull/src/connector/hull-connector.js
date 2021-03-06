// @flow

import type { $Application, Middleware } from "express";
import queueUIRouter from "hull/src/infra/queue/ui-router";
import OS from "os";
import _ from "lodash";
import cluster from "cluster";
import type { Server } from "http";
import express from "express";
import https from "http";
import minimist from "minimist";
import type {
  HullContext,
  HullServerConfig,
  HullContextGetter,
  HullJsonConfig,
  HullWorkerConfig,
  HullCompleteConnectorConfig,
  HullClient,
  HullCredentialsObject,
  HullRouterFactory,
  HullWorker
} from "../types/index";
import {
  jsonHandler,
  scheduleHandler,
  notificationHandler,
  batchHandler,
  incomingRequestHandler,
  htmlHandler,
  OAuthHandler,
  statusHandler
} from "../handlers";

import AppMetricsMonitor from "./appmetrics-monitor";
import errorHandler from "./error";

import buildConfigurationFromEnvironment from "../utils/config-from-env";
import mergeConfig from "../utils/merge-config";

const { compose } = require("compose-middleware");
const { renderFile } = require("ejs");
const debug = require("debug")("hull-connector");
const winston = require("winston");
const { staticRouter } = require("../utils");
const Worker = require("./worker");
const { Instrumentation, Cache, Queue, Batcher } = require("../infra");
const { onExit } = require("../utils");
const {
  workerContextMiddleware,
  extendedComposeMiddleware,
  baseComposedMiddleware
} = require("../middlewares");

const KafkaLogger = require("../utils/kafka-logger");

const getAbsolutePath = p => `${process.cwd()}/${p}`;

const getCallbacks = (handlers, category: string, handler: string) => {
  const cat = handlers[category];
  if (!cat) {
    throw new Error(
      `Trying to access an undefined handler category ${category}`
    );
  }
  const callback = cat[handler];
  if (!callback) {
    debug(`error in handlers ${category}`, cat);
    throw new Error(
      `Trying to access an undefined handler ${handler} in ${category}`
    );
  }
  return callback;
};

const {
  WEB_CONCURRENCY = 1,
  SERVER_MAX_CONNECTIONS,
  SERVER_BACKLOG = 511
} = process.env;

const getCPUCount = () => OS.cpus().length;

const getConcurrency = () => parseInt(WEB_CONCURRENCY || 1, 10);

const getMaxConnections = () =>
  parseInt(SERVER_MAX_CONNECTIONS, 10) || getCPUCount() || 10;

const getBacklogSize = () => parseInt(SERVER_BACKLOG, 10) || 511;

// const { TransientError } = require("../errors");

const TRANSPORTS = {
  console: winston.transports.Console,
  file: winston.transports.File,
  kafka: KafkaLogger
};

const transportsFromConfig = (transports: Array<TransportConfig>): Array<any> =>
  transports.map(({ type, options }) => new TRANSPORTS[type](options));

/**
 * An object that's available in all action handlers and routers as `req.hull`.
 * It's a set of parameters and modules to work in the context of current organization and connector instance.
 *
 * @namespace Context
 * @public
 */

/**
 * @public
 * @param {Object}        dependencies
 * @param {Object}        [options={}]
 * @param {string}        [options.connectorName] force connector name - if not provided will be taken from manifest.json
 * @param {string}        [options.hostSecret] secret to sign req.hull.token
 * @param {Number|string} [options.port] port on which expressjs application should be started
 * @param {Object}        [options.json] a Configuration to pass the body JSON parser, Default: { limit: "10mb" }
 * @param {Object}        [options.clientConfig] additional `HullClient` configuration
 * @param {boolean}       [options.skipSignatureValidation] skip signature validation on notifications (for testing only)
 * @param {number|string} [options.timeout] global HTTP server timeout - format is parsed by `ms` npm package
 * @param {Object}        [options.instrumentation] override default InstrumentationAgent
 * @param {Object}        [options.cache] override default CacheAgent
 * @param {Object}        [options.queue] override default QueueAgent
 * @param {Array}         [options.captureMetrics] an array to capture metrics
 * @param {Array}         [options.logsConfig] an object of type HullLogsConfig that describes the logger configuration
 * @param {boolean}       [options.disableOnExit=false] an optional param to disable exit listeners
 */
export default class HullConnector {
  middlewares: $PropertyType<HullCompleteConnectorConfig, "middlewares">;

  handlers: $PropertyType<HullCompleteConnectorConfig, "handlers">;

  _handlers: $PropertyType<HullCompleteConnectorConfig, "handlers">;

  manifest: $PropertyType<HullCompleteConnectorConfig, "manifest">;

  serverConfig: HullServerConfig;

  workerConfig: HullWorkerConfig;

  httpClientConfig: $PropertyType<
    HullCompleteConnectorConfig,
    "httpClientConfig"
  >;

  clientConfig: $PropertyType<HullCompleteConnectorConfig, "clientConfig">;

  jsonConfig: $PropertyType<HullCompleteConnectorConfig, "jsonConfig">;

  metricsConfig: $PropertyType<HullCompleteConnectorConfig, "metricsConfig">;

  logsConfig: $PropertyType<HullCompleteConnectorConfig, "logsConfig">;

  cacheConfig: $PropertyType<HullCompleteConnectorConfig, "cacheConfig">;

  connectorConfig: HullCompleteConnectorConfig;

  jsonConfig: HullJsonConfig;

  cache: Cache;

  queue: Queue;

  instrumentation: Instrumentation;

  _worker: Worker;

  Worker: Class<HullWorker>;

  Client: Class<HullClient>;

  app: $Application;

  server: Server;

  constructor(
    dependencies: {
      Worker: Class<Worker>,
      Client: Class<HullClient>
    },
    config: HullConnectorConfig
  ) {
    const connectorConfig = mergeConfig(
      config,
      buildConfigurationFromEnvironment(process.env)
    );

    const {
      manifest,
      instrumentation,
      cacheConfig,
      queueConfig = {},
      clientConfig,
      jsonConfig,
      serverConfig,
      workerConfig,
      httpClientConfig,
      metricsConfig,
      logsConfig,
      connectorName = _.kebabCase(manifest.name),
      middlewares = [],
      handlers,
      disableOnExit = false
    } = connectorConfig;

    logsConfig.transports = transportsFromConfig(logsConfig.transportConfigs);

    clientConfig.logger = winston.createLogger({
      level: connectorConfig.LOG_LEVEL,
      format: winston.format.json(),
      transports: logsConfig.transports
    });

    this.logsConfig = logsConfig || {};
    this.clientConfig = {
      ...clientConfig,
      logsConfig: this.logsConfig,
      connectorName: clientConfig.connectorName || connectorName
    };
    this.metricsConfig = metricsConfig || {};
    this.cacheConfig = {
      ttl: 60, // Seconds
      max: 5, // Connections to Redis (??) Shouldn't be used in newer cache-manager-redis-store
      store: "memory",
      ...cacheConfig
    };
    this.cache = new Cache(this.cacheConfig);
    this.workerConfig = workerConfig || {};
    this.httpClientConfig = httpClientConfig || {};
    this.jsonConfig = { limit: "50mb", strict: false, ...jsonConfig };
    this.serverConfig = serverConfig || { start: true };
    this.Client = dependencies.Client;
    this.Worker = dependencies.Worker;
    this.middlewares = middlewares;
    this.handlers = handlers;
    this.manifest = manifest;
    this.instrumentation =
      instrumentation || new Instrumentation(this.metricsConfig, manifest);
    this.queue = new Queue(queueConfig);

    // Rebuild a sanitized and defaults-enriched Connector Config
    this.connectorConfig = {
      ...connectorConfig,
      clientConfig: this.clientConfig,
      workerConfig: this.workerConfig,
      httpClientConfig: this.httpClientConfig,
      jsonConfig: this.jsonConfig,
      serverConfig: this.serverConfig,
      metricsConfig: this.metricsConfig,
      logsConfig: this.logsConfig,
      cacheConfig: this.cacheConfig
    };

    if (disableOnExit !== true) {
      onExit(() => {
        return Promise.all([
          Batcher.exit(),
          this.queue.exit(),
          dependencies.Client.exit()
        ]);
      });
    }
  }

  async start() {
    if (this.metricsConfig.statsd_host) {
      AppMetricsMonitor.start(this, {
        host: this.metricsConfig.statsd_host,
        port: this.metricsConfig.statsd_port
      });
    }

    if (this.workerConfig.start) {
      this.startWorker(this.workerConfig.queueName);
    } else {
      debug("No Worker started: `workerConfig.start` is false");
    }
    if (this.serverConfig.start) {
      const concurrency = getConcurrency();
      if (concurrency > 1) {
        if (cluster.isMaster) {
          console.log(
            `Starting cluster in Main Mode, with ${concurrency} instances`
          );
          for (let i = 0; i < concurrency; i += 1) {
            cluster.fork();
          }
          return;
        }
        debug("Starting cluster in Secondary Mode");
      } else {
        debug("Starting in Single process mode");
      }

      const app = express();

      if (this.connectorConfig.trustProxy) {
        app.set("trust proxy", this.connectorConfig.trustProxy);
      }

      this.app = app;
      const server = this.startApp(app);
      if (server) {
        this.server = server;
      }
      this.setupApp(app);
      await this.setupRoutes(app);
      this.setupErrorHandling(app);
      debug(`Started server on port ${this.connectorConfig.port}`);
    } else {
      debug("No Server started: `serverConfig.start === false`");
    }
    const argv = minimist(process.argv);
    if (argv.repl) {
      this.repl(_.pick(argv, "id", "organization", "secret"));
    }
  }

  async repl(credentials: {}) {
    // eslint-disable-next-line global-require
    const repl = require("hullrepl");
    return repl({
      credentials,
      middlewares: this.baseComposedMiddleware()
    });
  }

  stop() {
    this.server.close();
  }

  async getHandlers() {
    this._handlers =
      typeof this.handlers === "function"
        ? await this.handlers(this)
        : this.handlers;
    return this._handlers;
  }

  async setupRoutes(app: $Application) {
    const handlers = await this.getHandlers();
    // Don't use an arrow function here as it changes the context
    // Don't move it out of this closure either
    // https://github.com/expressjs/express/issues/3855

    const { rawCustomRoutes } = this.connectorConfig;
    if (rawCustomRoutes) {
      rawCustomRoutes.map(({ method, url, handler }) => {
        app[method](url, handler);
        return true;
      });
    }

    // This method wires the routes according to the configuration.
    // Methods are optional but they all have sane defaults
    const mapNotification = (factory, section = "subscriptions") =>
      (this.manifest[section] || []).map(({ url, channels }) => {
        if (channels) {
          const { router } = factory(
            channels.map(({ handler, channel, options }) => ({
              callback: getCallbacks(handlers, section, handler),
              channel,
              options
            }))
          );
          return app.post(url, router);
        }
        return app;
      });

    // Breaking proper separation of concerns here, but its the least invasive way to override route setup with oAuth handlers
    const mapRoute = (
      factory: HullRouterFactory,
      section = "json",
      defaultMethod = "all",
      entries = []
    ) =>
      entries.map(({ url, method = defaultMethod, handler, options }) => {
        if (!url) {
          return true;
        }
        const callback = getCallbacks(handlers, section, handler);
        if (!callback) {
          throw new Error(
            `Trying to setup a handler ${handler} that doesn't exist for url ${url}. Can't continue`
          );
        }
        if (!app[method || defaultMethod]) {
          throw new Error(
            `Trying to setup an unauthorized method: app.${method}`
          );
        }
        const res = factory({
          method: method || defaultMethod,
          options,
          callback
        });
        if (!res) {
          debug(
            `Skipping entry because no router was returned for ${section} / ${url}: ${handler}`
          );
          return false;
        }
        const { method: routerMethod, router } = res;
        // const m = handleMethod(method, defaultMethod, options)
        if (router) {
          // $FlowFixMe
          app[routerMethod](url, router);
          // app[method || defaultMethod](url, router);
          debug(
            `Setting up ${routerMethod.toUpperCase()} ${url}: ${handler} / ${!!callback}`
          );
        } else {
          debug(
            `Skipping ${routerMethod.toUpperCase()} ${url} ${handler} because no router was generated`
          );
        }
        return true;
      });

    // Setup Kraken handlers
    mapNotification(notificationHandler, "subscriptions");

    // Setup Batch handlers
    mapNotification(batchHandler, "batches");

    // Statuses handlers
    // Be careful - these handlers return a specific data format
    mapRoute(statusHandler, "statuses", "all", this.manifest.statuses);

    // Setup Schedule handlers
    mapRoute(scheduleHandler, "schedules", "all", this.manifest.schedules);

    // Setup Tab handlers
    mapRoute(htmlHandler, "tabs", "all", this.manifest.tabs);
    mapRoute(htmlHandler, "html", "all", this.manifest.html);

    // TODO: Alpha-quality Credentials handlers - DO NOT expose both tab oAuth and Credentials
    mapRoute(
      OAuthHandler,
      "private_settings",
      "all",
      (this.manifest.private_settings || []).filter(
        s => !!s.url && !!s.handler && s.format.toLowerCase() === "oauth"
      )
    );

    mapRoute(
      jsonHandler,
      "private_settings",
      "all",
      (this.manifest.private_settings || []).filter(
        s => !!s.url && !!s.handler && s.format.toLowerCase() !== "oauth"
      )
    );

    // Setup JSON handlers
    mapRoute(jsonHandler, "json", "all", this.manifest.json);

    // Setup Incoming Data handlers
    mapRoute(incomingRequestHandler, "incoming", "all", this.manifest.incoming);
  }

  baseComposedMiddleware() {
    return baseComposedMiddleware({
      Client: this.Client,
      instrumentation: this.instrumentation,
      queue: this.queue,
      cache: this.cache,
      connectorConfig: this.connectorConfig
    });
  }

  getContext: HullContextGetter = async ({
    token,
    clientCredentialsToken,
    clientCredentialsEncryptedToken
  }: HullCredentialsObject): Promise<HullContext> => {
    const composedMiddleware = compose(
      this.baseComposedMiddleware(),
      extendedComposeMiddleware({
        handlerName: "getContext",
        requestName: "getContext",
        options: {
          credentialsFromNotification: false,
          credentialsFromQuery: true,
          strict: false
        }
      })
    );
    return new Promise((resolve, reject) => {
      // $FlowFixMe
      const ctx: HullContext = {
        token,
        clientCredentialsToken,
        clientCredentialsEncryptedToken
      };
      const noop = () => {};
      composedMiddleware(
        { on: noop, emit: noop, headers: [], body: {}, hull: ctx },
        {},
        (err, _req, _res) => {
          if (err instanceof Error) {
            reject(err);
          }
          resolve(ctx);
        }
      );
    });
  };

  /**
   * This method applies all features of `Hull.Connector` to the provided application:
   *   - serving `/manifest.json`, `/readme` and `/` endpoints
   *   - serving static assets from `/dist` and `/assets` directiories
   *   - rendering `/views/*.html` files with `ejs` renderer
   *   - timeouting all requests after 25 seconds
   *   - adding Newrelic and Sentry instrumentation
   *   - initiating the wole [Context Object](#context)
   *   - handling the `hullToken` parameter in a default way
   * @public
   * @param  {express} app expressjs application
   * @return {express}     expressjs application
   */
  setupApp(app: $Application): $Application {
    this.middlewares.map(middleware => app.use(middleware));
    app.use(this.baseComposedMiddleware());
    app.disable("etag");
    app.use(
      "/",
      staticRouter({ path: process.cwd(), manifest: this.manifest })
    );
    app.use(
      "/__queue",
      queueUIRouter({
        hostSecret: this.connectorConfig.hostSecret,
        queue: this.queue
      })
    );
    app.engine("html", renderFile);
    app.engine("md", renderFile);
    app.engine("ejs", renderFile);
    app.engine("md.ejs", renderFile);
    app.set("views", getAbsolutePath("views"));
    app.set("view engine", "ejs");
    return app;
  }

  setupErrorHandling(app: $Application): $Application {
    /**
     * Instrumentation Middleware,
     * this sends all errors to sentry
     */
    app.use(this.instrumentation.stopMiddleware());

    /**
     * Unhandled error middleware
     */
    app.use(errorHandler(this.Client));

    return app;
  }

  /**
   * This is a supplement method which calls `app.listen` internally and also terminates instrumentation of the application calls.
   * If any error is not caught on handler level it will first go through instrumentation handler reporting it to sentry
   * and then a `500 Unhandled Error` response will be send back to the client.
   * The response can be provided by the handler before passing it here.
   * @public
   * @param  {express} app expressjs application
   * @return {http.Server}
   */
  startApp(app: $Application): Promise<?Server> {
    const { port } = this.connectorConfig;
    const maxConnections = getMaxConnections();
    const backlog = getBacklogSize();
    const server = https.createServer(app);
    server.listen(
      {
        port: parseInt(port, 10),
        backlog
        // exclusive: true
      },
      () => {
        debug("connector.server.listen", { port, backlog, maxConnections });
      }
    );
    server.maxConnections = maxConnections;
    return server;
  }

  use(middleware: Middleware) {
    this.middlewares.push(middleware);
    return this;
  }

  async startWorker(queueName: string = "queueApp"): Promise<Worker> {
    this.instrumentation.exitOnError = true;
    const { jobs } = await this.getHandlers();
    if (!jobs) {
      console.warn(
        "Worker is started but no jobs hash is declared in Handlers"
      );
    }
    this._worker = new this.Worker({
      instrumentation: this.instrumentation,
      queue: this.queue,
      jobs
    });
    this.middlewares.map(this._worker.use);
    this._worker.use(this.baseComposedMiddleware());
    this._worker.use(workerContextMiddleware());
    this._worker.process(queueName);
    debug("connector.worker.process", { queueName });
    return this._worker;
  }
}

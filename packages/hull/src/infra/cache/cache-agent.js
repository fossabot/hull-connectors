// @flow
import type { HullContext, HullCacheConfig } from "hull";
import redisStore from "cache-manager-redis-store";

const cacheManager = require("cache-manager");
const ConnectorCache = require("./connector-cache");
const PromiseReuser = require("../../utils/promise-reuser");

/**
 * This is a wrapper over https://github.com/BryanDonovan/node-cache-manager
 * to manage ship cache storage.
 * It is responsible for handling cache key for every ship.
 *
 * By default it comes with the basic in-memory store, but in case of distributed connectors being run in multiple processes for reliable operation a shared cache solution should be used. The `Cache` module internally uses [node-cache-manager](https://github.com/BryanDonovan/node-cache-manager), so any of it's compatibile store like `redis` or `memcache` could be used:
 *
 * The `cache` instance also exposes `contextMiddleware` whch adds `req.hull.cache` to store the ship and segments information in the cache to not fetch it for every request. The `req.hull.cache` is automatically picked and used by the `Hull.Middleware` and `segmentsMiddleware`.
 *
 * > The `req.hull.cache` can be used by the connector developer for any other caching purposes:
 *
 * ```javascript
 * ctx.cache.get('object_name');
 * ctx.cache.set('object_name', object_value);
 * ctx.cache.wrap('object_name', () => {
 *   return Promise.resolve(object_value);
 * });
 * ```
 *
 * > There are two <code>object names</code> which are reserved and cannot be used here:
 * >
 * > - any ship id
 * > - "segments"
 *
 * > **IMPORTANT** internal caching of `ctx.ship` object is refreshed on `ship:update` notifications, if the connector doesn't subscribe for notification at all the cache won't be refreshed automatically. In such case disable caching, set short TTL or add `notifHandler`
 *
 * @public
 * @memberof Infra
 * @param {Object} options passed to node-cache-manager
 * @example
 *
 * const cacheConfig = {
 *   store: "redis",
 *   url: 'redis://:XXXX@localhost:6379/0?ttl=600'
 * };
 *
 * const connector = new Hull.Connector({ cacheConfig });
 */
class CacheAgent {
  cache: any;

  getConnectorCache: any;

  promiseReuser: PromiseReuser;

  getOptions(options) {
    const { store } = options;
    if (store === "redis") {
      return {
        ...options,
        store: redisStore
      };
    }
    return {
      ...options,
      store: "memory"
    };
  }

  constructor(options: HullCacheConfig) {
    this.cache = cacheManager.caching(this.getOptions(options));
    this.getConnectorCache = this.getConnectorCache.bind(this);
    this.promiseReuser = new PromiseReuser();
  }

  getConnectorCache(ctx: HullContext) {
    // eslint-disable-line class-methods-use-this
    return new ConnectorCache(ctx, this.cache, this.promiseReuser);
  }
}

module.exports = CacheAgent;

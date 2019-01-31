// @flow
import type { HullConnector } from "hull-client";

import type { HullContext } from "../types";

const {
  applyConnectorSettingsDefaults,
  trimTraitsPrefixFromConnector
} = require("../utils");

/**
 * Allows to update selected settings of the ship `private_settings` object. This is a wrapper over `hullClient.utils.settings.update()` call. On top of that it makes sure that the current context ship object is updated, and the ship cache is refreshed.
 * It will emit `ship:update` notify event.
 *
 * @public
 * @name updateSettings
 * @memberof Utils
 * @param {Object} ctx The Context Object
 * @param  {Object} newSettings settings to update
 * @return {Promise}
 * @example
 * req.hull.helpers.settingsUpdate({ newSettings });
 */
function settingsUpdate(
  ctx: HullContext,
  newSettings: $PropertyType<HullConnector, "private_settings">
): Promise<HullConnector> {
  const { client, cache } = ctx;
  return client.utils.settings.update(newSettings).then(connector => {
    applyConnectorSettingsDefaults(connector);
    trimTraitsPrefixFromConnector(connector);
    ctx.connector = connector;
    if (!cache) {
      return connector;
    }
    return cache.del("connector").then(() => connector);
  });
}

module.exports = settingsUpdate;

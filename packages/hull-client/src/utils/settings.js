// @flow

import type {
  HullConnector,
  HullConnectorSettings
} from "../../../hull/src/types";

/* TODO: Move this to Hull Connector framework because that's where it belongs */

/**
 * Updates `private_settings` merging them with existing ones before.
 *
 * Note: this method will trigger `hullClient.put` and will result in `ship:update` notify event coming from Hull platform - possible loop condition.
 * @memberof Utils
 * @method   settings.update
 * @public
 * @param  {Object} newSettings settings to update
 * @param  {Boolean} refreshStatus force the platform to refresh the connector status synchronously
 * @return {Promise}
 */
function update(
  newSettings: HullConnectorSettings,
  refreshStatus: Boolean = false
): Promise<HullConnector> {
  return this.get("app").then((connector: HullConnector) => {
    const private_settings: HullConnectorSettings = {
      ...connector.private_settings,
      ...newSettings
    };
    connector.private_settings = private_settings;
    return this.put(connector.id, {
      private_settings,
      refresh_status: refreshStatus
    });
  });
}

module.exports = {
  update
};

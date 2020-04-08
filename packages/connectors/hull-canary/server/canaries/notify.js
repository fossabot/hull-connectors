const _ = require("lodash");

const {
  hasStarted,
  hasCompleted,
  getActiveStage,
  hasNextStage,
  nextStage,
  getStageStatus,
  receiveUserUpdate,
  receiveAccountUpdate
} = require("./state");

const { canariesStartNext } = require("./handler");

async function canaryNotify(updateChannel, context, messages) {
  if (!hasStarted() || hasCompleted()) return;

  let reportType = null;
  let objectType = null;
  if (updateChannel === "user:update") {
    reportType = "user_report";
    objectType = "user";
    await receiveUserUpdate(messages, context);
  } else if (updateChannel === "account:update") {
    reportType = "account_report";
    objectType = "account";
    await receiveAccountUpdate(messages, context);
  }

  if (reportType !== null) {
    const { client } = context;

    for (let i = 0; i < messages.length; i += 1) {
      const response = await client.api(`/search/${reportType}`, "post", {
        query: {
          bool: {
            filter: [
              {
                terms: {
                  _id: [messages[i][objectType].id]
                }
              }
            ]
          }
        },
        sort: { created_at: "asc" },
        raw: true,
        page: 1,
        per_page: 2
      });
      if (response.data.length === 1) {
        const responseFromEs = response.data[0];
        const objectFromEs = _.reduce(
          responseFromEs,
          (agg, value, key) => {
            let newKey = key;
            if (_.startsWith(newKey, "traits_")) {
              newKey = key.substring("traits_".length);
            }
            agg[newKey] = value;
            return agg;
          },
          {}
        );

        const objectFromKraken = messages[i][objectType];

        const isMatching = _.isMatchWith(
          objectFromEs,
          objectFromKraken,
          (objValue, srcValue, key, object, source) => {
            // indexed_at isn't going to be equal because of timing, so return true to skip it in equality
            if (key === "indexed_at") {
              return true;
            }
            return undefined;
          }
        );

        if (!isMatching) {
          throw new Error("Objects are not equal!");
        }
      } else {
        throw new Error("Objects are ambiguous!");
      }
    }
  }

  const stageStatus = getStageStatus();
  if (stageStatus.failed) {
    canariesStartNext(true);
  } else if (stageStatus.completed) {
    console.log("Current Stage Complete");
    const activeCanaryStage = getActiveStage();
    if (activeCanaryStage.successCallback) {
      activeCanaryStage.successCallback(context);
    }

    if (hasNextStage()) {
      nextStage();
    } else {
      canariesStartNext(false);
    }
  }
}

module.exports = {
  canaryNotify
};

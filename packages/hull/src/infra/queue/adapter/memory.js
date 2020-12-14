const _ = require("lodash");

/**
 * Memory adapter
 */
class MemoryAdapter {
  constructor() {
    this.queue = {};
    this.processors = {};
    [
      "inactiveCount",
      "activeCount",
      "completeCount",
      "failedCount",
      "delayedCount"
    ].forEach(name => {
      this[name] = () => Promise.resolve(0);
    });
  }

  /**
   * @param {string} jobName queue name
   * @param {Object} jobPayload
   * @return {Promise}
   */
  create(ctx, jobName, jobPayload = {}) {
    // if (delay) {
    //   setTimeout(this.enqueue.bind(this, jobName, jobPayload), delay);
    //   return Promise.resolve();
    // }

    return this.enqueue(jobName, jobPayload);
  }

  enqueue(jobName, jobPayload) {
    this.queue[jobName] = this.queue[jobName] || [];
    this.queue[jobName].push({
      progress: () => {},
      id: this.queue[jobName].length,
      data: _.merge(
        {
          name: jobName
        },
        jobPayload
      )
    });
    return this.processQueues();
  }

  setupUiRouter(_router) {}

  /**
   * @param {string} jobName
   * @param {Function} jobCallback
   * @return {Object} this
   */
  process(jobName, jobCallback) {
    this.processors[jobName] = jobCallback;
    this.processQueues();
    return this;
  }

  processQueues() {
    return Promise.all(
      _.map(this.processors, (jobCallback, jobName) => {
        if (_.get(this.queue, jobName, []).length === 0) {
          return Promise.resolve();
        }
        const job = this.queue[jobName].pop();
        return jobCallback(job);
      })
    );
    // .then(() => {
    //   this.processQueues();
    // }, () => {
    //   this.processQueues();
    // });
  }

  exit() {
    return Promise.resolve(this);
  }

  clean() {} // eslint-disable-line class-methods-use-this
}

module.exports = MemoryAdapter;

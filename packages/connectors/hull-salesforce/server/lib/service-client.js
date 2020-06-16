/* @flow */
import type {
  IServiceClient,
  IApiResultObject,
  IInsertUpdateOptions,
  ILogger,
  IMetricsClient,
  ISalesforceClientOptions,
  TApiOperation,
  TDeletedRecordInfo,
  TDeletedRecordsParameters,
  THullObject,
  TInsertUpdateOptions,
  TResourceType,
  TResourceTypeAssignmentRule
} from "./types";

import type { TAssignmentRule } from "./service-client/assignmentrules";

const _ = require("lodash");
const events = require("events");
const Promise = require("bluebird");

const Connection = require("./service-client/connection");
const { executeApiOperationSoap } = require("./service-client/execute-apioperation");
const { find } = require("./service-client/find");
const getAssignmentRules = require("./service-client/assignmentrules");
const QueryUtil = require("./sync-agent/query-util");

const CONNECTION_EVENTS = ["request.sent", "request.usage", "request.error", "refresh", "error"];

// We cannot go higher than 750 because the SOQL query has a limit of 20k characters;
// each ID has between 14 and 16 characters, plus 2 characters for ' escape characters plus delimiter
// plus about 50 characters of overhead.
const FETCH_CHUNKSIZE = Math.min(parseInt(process.env.FETCH_CHUNKSIZE, 10) || 500, 750);

class ServiceClient extends events.EventEmitter implements IServiceClient {
  /**
   * Gets or sets the connection to use.
   *
   * @type {Connection}
   * @memberof SalesforceClient
   */
  connection: Connection;

  /**
   * Gets or sets the logger
   *
   * @type {ILogger}
   * @memberof SalesforceClient
   */
  logger: ILogger;

  /**
   * Gets or sets the metrics client.
   *
   * @type {IMetricsClient}
   * @memberof SalesforceClient
   */
  metricsClient: IMetricsClient;

  queryUtil: QueryUtil;

  /**
   * Creates an instance of SalesforceClient.
   * @param {ISalesforceClientOptions} options The configuration options.
   * @memberof SalesforceClient
   */
  constructor(options: ISalesforceClientOptions) {
    super();
    const connection = new Connection(options.connection);
    connection.setLogger(options.logger);
    connection.setMetric(options.metrics);
    // re-emit connection events upstream
    CONNECTION_EVENTS.forEach(
      e => connection.on(e, this.emit.bind(this, `connection.${e}`))
    );
    this.connection = connection;
    this.logger = options.logger;
    this.metricsClient = options.metrics;
    this.queryUtil = new QueryUtil();
  }

  // eslint-disable-next-line no-unused-vars
  getSoqlQuery(type: TResourceType, fields: Array<string>, accountClaims: Array<Object>): string {
    const { selectFields, requiredFields } = this.queryUtil.getSoqlFields(type, fields, accountClaims);

    let query = `SELECT ${selectFields} FROM ${type}`;
    if (type === "Account" && !_.isNil(requiredFields) && requiredFields.length > 0) {
      query += ` WHERE ${requiredFields[0]} != null`;

      for (let i = 1; i < requiredFields.length; i += 1) {
        const requiredField = requiredFields[i];
        query += ` AND ${requiredField} != null`;
      }
    }
    return query;
  }

  /**
   * Finds the records by Id via SOQL query which has a high limit.
   *
   * @param type
   * @param {string[]} identifiers The list of identifiers.
   * @param {string[]} fields The list of fields.
   * @param accountClaims
   * @param options
   * @returns {Promise<any[]>} A list of Salesforce objects.
   * @memberof SalesforceClient
   */
  // eslint-disable-next-line no-unused-vars
  findRecordsById(type: TResourceType, identifiers: string[], fields: string[], accountClaims: Array<Object>, options: Object = {}): Promise<any[]> {
    const executeQuery = _.get(options, "executeQuery", "query");
    const idsList = identifiers.map(id => `'${id}'`).join(",");
    const { selectFields, requiredFields } = this.queryUtil.getSoqlFields(type, fields, accountClaims);
    let query = `SELECT ${selectFields} FROM ${type} WHERE Id IN (${idsList})`;

    if (type === "Account") {
      _.forEach(requiredFields, (requiredField) => {
        query += ` AND ${requiredField} != null`;
      });
    }
    return this.exec(executeQuery, query).then(({ records }) => records);
  }

  findRecordById(type: TResourceType, id: string): Promise<any[]> {
    const { selectFields } = this.queryUtil.getSoqlFields(type, [], []);
    const query = `SELECT ${selectFields} FROM ${type} WHERE Id = '${id}'`;
    return this.exec("query", query).then(({ records }) => records);
  }

  /**
   * Executes the insert operation against the Salesforce API.
   *
   * @param {Array<THullObject>} records The records to insert/create in Salesforce.
   * @param {TInsertUpdateOptions} options The options to execute the operation.
   * @returns {Promise<IApiResultObject[]>} A list of result objects.
   * @memberof SalesforceClient
   */
  insert(records: Array<THullObject>, options: IInsertUpdateOptions): Promise<IApiResultObject[]> {
    if (records.length === 0) {
      return Promise.resolve([]);
    }

    return Promise.map(_.chunk(records, 200), (chunkOfRecords) => {
      const ops: TApiOperation = {
        method: "insert",
        resource: options.resource,
        records: chunkOfRecords
      };

      if (!_.isNil(options.leadAssignmentRule) && _.isString(options.leadAssignmentRule)) {
        _.set(ops, "leadAssignmentRule", options.leadAssignmentRule);
      }

      this.metricsClient.increment("ship.service_api.call", 1);
      return executeApiOperationSoap(this.connection, ops);
      // FIXME: Handle conn.limitInfo to log metrics for ship.service_api.remaining and ship.service_api.limit
    }).then(_.flatten);
  }

  /**
   * Executes the update operation against the Salesforce API.
   *
   * @param {Array<THullObject>} records The records to update in Salesforce.
   * @param {TInsertUpdateOptions} options The options to execute the operation.
   * @returns {Promise<IApiResultObject[]>} A list of result objects.
   * @memberof SalesforceClient
   */
  update(records: Array<THullObject>, options: TInsertUpdateOptions): Promise<IApiResultObject[]> {
    if (records.length === 0) {
      return Promise.resolve([]);
    }

    return Promise.map(_.chunk(records, 200), (chunkOfRecords) => {
      const ops: TApiOperation = {
        method: "update",
        resource: options.resource,
        records: chunkOfRecords
      };

      if (!_.isNil(options.leadAssignmentRule) && _.isString(options.leadAssignmentRule)) {
        _.set(ops, "leadAssignmentRule", options.leadAssignmentRule);
      }

      this.metricsClient.increment("ship.service_api.call", 1);
      return executeApiOperationSoap(this.connection, ops);
      // FIXME: Handle conn.limitInfo to log metrics for ship.service_api.remaining and ship.service_api.limit
    }).then(_.flatten);
  }

  /**
   * Fetches the list of fields for the given resource.
   *
   * @param {TResourceType} type The type of resource.
   * @returns {any} An object containing the list of fields.
   * @memberof SalesforceClient
   */
  fetchFieldsList(type: TResourceType): any {
    return this.exec("describe", type).then((meta) => {
      return meta.fields.reduce((fields, f) => {
        const fi = _.merge({}, fields, { [f.name]: f });
        return fi;
      }, {});
    });
  }

  fetchResourceSchema(type: TResourceType, fieldTypes: string): any {
    return this.exec("describe", type).then((meta) => {
      return _.reduce(_.filter(meta.fields, (field) => {
        return _.includes(fieldTypes, field.type);
      }), (fields, f) => {
        return _.merge({}, fields, { [f.name]: f.type });
      }, {});
    });
  }

  /**
   * Retrieves assignment rules for the specified object type.
   *
   * @param {TAssignmentRuleObjectType} type The object type to retrieve assignment rules for.
   * @returns {Promise<TAssignmentRule[]>} A Promise that wraps an array of assignment rules.
   * @memberof SalesforceClient
   */
  fetchAssignmentRules(type: TResourceTypeAssignmentRule): Promise<TAssignmentRule[]> {
    return getAssignmentRules(this.connection, type);
  }

  /**
   * Finds all matching leads within Salesforce.
   *
   * @param {*} query A MongoDB like query.
   * @param {string[]} fields The fields to return from the query.
   * @param {number} limit The number of records to retrieve.
   * @param {number} skip The number of records to skip, used for pagination.
   * @returns {Promise<any[]>} A list of leads.
   * @memberof SalesforceClient
   */
  findLeads(query: any, fieldsList: string[], limit: number = 10000, skip: number = 0): Promise<any[]> {
    if (_.isEmpty(query)) return Promise.resolve([]);
    const fields = _.fromPairs(fieldsList.map(f => [f, 1]));
    return find(this.connection, "Lead", query, fields, limit, skip);
  }

  /**
   * Finds all matching contacts within Salesforce.
   *
   * @param {*} query A MongoDB like query.
   * @param {string[]} fields The fields to return from the query.
   * @param {number} limit The number of records to retrieve.
   * @param {number} skip The number of records to skip, used for pagination.
   * @returns {Promise<any[]>} A list of contacts.
   * @memberof SalesforceClient
   */
  findContacts(query: any, fieldsList: string[], limit: number = 10000, skip: number = 0): Promise<any[]> {
    if (_.isEmpty(query)) return Promise.resolve([]);
    const fields = _.fromPairs(fieldsList.map(f => [f, 1]));
    return find(this.connection, "Contact", query, fields, limit, skip);
  }

  /**
   * Finds all matching accounts within Salesforce.
   *
   * @param {*} query A MongoDB like query.
   * @param {string[]} fields The fields to return from the query.
   * @param {number} limit The number of records to retrieve.
   * @param {number} skip The number of records to skip, used for pagination.
   * @returns {Promise<any[]>} A list of accounts.
   * @memberof SalesforceClient
   */
  findAccounts(query: any, fieldsList: string[], limit: number = 10000, skip: number = 0): Promise<any[]> {
    if (_.isEmpty(query)) return Promise.resolve([]);
    const fields = _.fromPairs(fieldsList.map(f => [f, 1]));
    return find(this.connection, "Account", query, fields, limit, skip);
  }

  /**
   * Finds all matching objects within Salesforce.
   */
  async queryExistingRecords(type: string, sfdcId: string, recordIds: string[]): Promise<any[]> {
    const params = {};
    _.set(params, sfdcId, { $in: recordIds });
    return this.connection.sobject(type).find(params);
  }

  /**
   * Executes the given function using the connection.
   *
   * @param {string} fn The name of the function.
   * @param {...any} args The arguments of the function.
   * @returns {Promise<any>} A Promise holding the result.
   * @memberof SalesforceClient
   */
  exec(fn: string, ...args: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.connection[fn].apply(this.connection, [...args, (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      }]);
    });
  }

  /**
   * Gets all records from Salesforce using autoFetch.
   * -LEGACY Implementation-
   *
   * @param type TResourceType
   * @param fields
   * @param accountClaims
   * @param {Function} onRecord Callback that is invoked for every record received.
   * @returns {Promise<any>} The query type and fields that have been used for execution.
   * @memberof SalesforceClient
   */
  getAllRecords(type: TResourceType, fields: Array<string> = [], accountClaims: Array<Object> = [], onRecord: Function): Promise<*> {
    const progressFrequency = 0.1; // log progress every 10% of fetch
    let progressIncrement = null;
    return new Promise((resolve, reject) => {
      const soql = this.getSoqlQuery(type, fields, accountClaims);

      const query = this.connection.query(soql)
        .on("record", (record, numRecord, executingQuery) => {
          const { totalFetched, totalSize } = executingQuery;

          if (_.isNil(progressIncrement)) {
            progressIncrement = Math.ceil((totalSize) * (progressFrequency));
          }

          // eslint-disable-next-line
          const showProgress = totalFetched % progressIncrement === 0 || totalFetched === totalSize;
          return showProgress ? onRecord(record, { totalFetched, totalSize }) : onRecord(record);
        })
        .on("end", () => {
          resolve({ query, type, fields });
        })
        .on("error", (err) => {
          reject(err);
        })
        .run({ autoFetch: true, maxFetch: 500000 });
    });
  }

  /**
   * Gets the updated records within ac certain timeframe from Salesforce.
   * -MOSTLY LEGACY Implementation-
   *
   * @param {TResourceType} type The type of resource.
   * @param {Object} [options={}] Options that control the behavior.
   * @param onRecord
   * @param concurrency
   * @returns {Promise<Object[]>} A list of updated records.
   * @memberof SalesforceClient
   */
  getUpdatedRecords(type: TResourceType, options: Object = {}, onRecord: Function, concurrency: number = 2): Promise<*> {
    const fields = options.fields || [];
    const accountClaims = options.account_claims || [];
    const since = options.since ? new Date(options.since) : new Date(new Date().getTime() - (3600 * 1000));
    const until = options.until ? new Date(options.until) : new Date();

    return new Promise((resolve, reject) => {
      return this.connection.sobject(type).updated(
        since.toISOString(),
        until.toISOString(),
        (err, res = {}) => {
          if (err) {
            return reject(err);
          }
          const chunks = _.chunk(_.get(res, "ids", []), FETCH_CHUNKSIZE);
          return Promise.map(chunks, (ids) => {
            return this.findRecordsById(type, ids, fields, accountClaims, options)
              .then((records) => {
                this.metricsClient.increment((type === "Account" ? "ship.incoming.accounts" : "ship.incoming.users"), records.length);
                return Promise.all(records.map(record => onRecord(record)));
              });
          }, { concurrency })
            .then(resolve)
            .catch(reject);
        }
      );
    });
  }

  getDeletedRecords(type: TResourceType, options: Object = {}, onRecord: Function, concurrency: number = 2): Promise<*> {
    const fields = options.fields || [];
    const accountClaims = options.accountClaims;
    const since = options.since;
    const until = new Date();

    return new Promise((resolve, reject) => {
      return this.connection.sobject(type).deleted(since, until)
        .then((recordsInfo) => {
          const deletedRecords = recordsInfo.deletedRecords ? recordsInfo.deletedRecords : [];
          const recordIds = _.map(deletedRecords, "id");
          const chunks = _.chunk(recordIds, FETCH_CHUNKSIZE);
          return Promise.map(chunks, (ids) => {
            _.set(options, "executeQuery", "queryAll");
            return this.findRecordsById(type, ids, fields, accountClaims, options)
              .then((records) => {
                return Promise.all(records.map((record) => {
                  return onRecord(record);
                }));
              });
          }, { concurrency })
            .then(resolve)
            .catch(reject);
        });
    });
  }

  /**
   * Gets all deleted records within a certain timeframe in Salesforce.
   *
   * @param {TResourceType} type The type of the resource.
   * @param {TDeletedRecordsParameters} options The query options.
   * @returns {Promise<Array<TDeletedRecordInfo>>} A list of deleted records.
   * @memberof ServiceClient
   */
  getDeletedRecordsData(type: TResourceType, options: TDeletedRecordsParameters): Promise<Array<TDeletedRecordInfo>> {
    return this.connection.sobject(type).deleted(options.start, options.end)
      .then((recordsInfo) => {
        return recordsInfo.deletedRecords ? recordsInfo.deletedRecords : [];
      });
  }
}

module.exports = ServiceClient;

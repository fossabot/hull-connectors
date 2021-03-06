const {
  ifL,
  cond,
  settings,
  settingsUpdate,
  set,
  ex,
  utils,
  moment,
  route,
  cast,
  get,
  returnValue,
  transformTo,
  jsonata,
  or,
  iterateL,
  ld,
  hull,
  Svc
} = require("hull-connector-framework/src/purplefusion/language");

const { BigqueryUserRead, BigqueryAccountRead, BigqueryEventRead } = require("./service-objects");
const { HullIncomingUser, HullIncomingAccount } = require("hull-connector-framework/src/purplefusion/hull-service-objects");

function bigquery(op: string, param?: any): Svc {
  return new Svc({ name: "bigquery", op }, param);
}

const refreshTokenDataTemplate = {
  refresh_token: "${connector.private_settings.refresh_token}",
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  grant_type: "refresh_token"
};

const jobPayloadTemplate = {
    configuration: {
      query: {
        query: "${connector.private_settings.query}",
        useLegacySql: false,
      }
    },
    jobReference: {
      projectId: "${projectId}",
      jobId: "${jobId}"
    },
  };

const OPERATION_MAPPING = {
  users: {
    hull: "asUser",
    type: BigqueryUserRead,
    transformTo: HullIncomingUser
  },
  accounts: {
    hull: "asAccount",
    type: BigqueryAccountRead,
    transformTo: HullIncomingAccount
  },
  events: {
    hull: "asUser",
    type: BigqueryEventRead,
    transformTo: HullIncomingUser
  }
};

const glue = {
  ensure: [
    set("jobId", settings("job_id")),
    set("projectId", settings("project_id")),
    set("importType", settings("import_type")),
    set("operation", get("${importType}", OPERATION_MAPPING)),
    set("service_name", "bigquery")
  ],
  isConfigured: cond("allTrue", [
    cond("notEmpty", settings("access_token")),
    cond("notEmpty", settings("refresh_token")),
  ]),
  isAuthenticated: cond("allTrue", [
    cond("notEmpty", settings("access_token")),
    cond("notEmpty", settings("refresh_token"))
  ]),
  getProjects: returnValue([
    ifL(route("isAuthenticated"), [
      set("projectsMap", jsonata(`[$.{"value": id, "label":friendlyName}]`, bigquery("getProjects")))
    ])
    ],
    {
      status: 200,
      data: {
        options: "${projectsMap}"
      }
    }
  ),
  status: ifL(cond("isEmpty", settings("access_token")), {
    do: {
      status: "setupRequired",
      message: "Connector has not been authenticated with Bigquery."
    },
    eldo: {
      status: "ok",
      message: "allgood"
    }
  }),
  checkJob: [
    ifL([
      route("isConfigured"),
      or([
        cond("notEmpty", settings("job_id")),
        cond("notEmpty", "${jobId}")
      ])
    ], [
      set("jobStatus", bigquery("getJob")),
      ifL(cond("isEqual", "${jobStatus.status.state}", "DONE"), {
        do: [
          ifL([
            cond("isEmpty", "${jobStatus.status.errorResult}"),
            cond("isEmpty", "${jobStatus.status.errors}")
          ], {
            // all good, ready for import
            do: [
              route("importResults"),
              utils("logInfo", "incoming.job.finished")
            ],
            // job is finished but has some errors
            eldo: utils("logError", "incoming.job.error: ${jobStatus.status.errors}")
          }),
          // In any case, we no longer follow the job
          settingsUpdate({ job_id: null })
        ],
        eldo:
          ifL(cond("isEmpty", "${jobStatus}"), {
            do: [
              utils("logInfo", "incoming.job.error: The tracked job ${jobId} doesn't exist or has been removed, skipping"),
              settingsUpdate({ job_id: null }),
            ],
            eldo: utils("logInfo", "incoming.job.progress: ${jobStatus.statistics}")
          })
      }),
    ])
  ],
  startImport: [
    ifL(cond("isEmpty", "${jobId}"), {
      do: ifL(route("isConfigured"), [
        set("nowTime", ex(moment(), "unix")),
        set("jobId", "hull_import_${connector.id}_${nowTime}"),
        ifL(cond("isEmpty", get("error", bigquery("insertQueryJob", jobPayloadTemplate))), [
          settingsUpdate({ job_id: "${jobId}"}),
          utils("logInfo", "incoming.job.start: ${jobStatus.statistics}"),
          route("checkJob")
        ])
      ]),
      eldo: [
        utils("logError", "incoming.job.error: a job is already running. Wait for it to finish.")
      ]
    })
  ],
  import: route("startImport"),
  manualImport: route("startImport"),
  importResults: [
    set("queryPageResults", bigquery("getJobResults")),
    set("arrangedResults", jsonata("[$.rows.(\n" +
      "    $merge(\n" +
      "        $map($.f, function($v, $i) {\n" +
      "            {\n" +
      "                $$.schema.fields[$i].name: $v.v\n" +
      "            }\n" +
      "        })\n" +
      "    )\n" +
      ")]\n", "${queryPageResults}")),
    iterateL("${arrangedResults}", { key: "entity", async: true }, [
      hull("${operation.hull}", cast("${operation.type}", "${entity}"))
    ]),
    ifL(cond("notEmpty", "${queryPageResults.pageToken}"), [
      set("pageToken", "${queryPageResults.pageToken}"),
      route("importResults")
    ])
  ],
  refreshToken:
    ifL(cond("notEmpty", "${connector.private_settings.refresh_token}"), [
      ifL(cond("notEmpty", set("refreshTokenResponse", bigquery("refreshToken", refreshTokenDataTemplate))),
        settingsUpdate({
          access_token: "${refreshTokenResponse.access_token}",
          token_expires_in: "${refreshTokenResponse.expires_in}",
          token_fetched_at: ex(ex(moment(), "utc"), "format"),
        })
      )
    ]),
  stopTracking: [
    utils("logInfo", "The tracked job ${jobId} doesn't exist or has been removed, skipping"),
    settingsUpdate({ job_id: null }),
    set("jobId", null)
  ]
};

module.exports = glue;

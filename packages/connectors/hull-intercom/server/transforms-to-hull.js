/* @flow */

import type { ServiceTransforms } from "hull-connector-framework/src/purplefusion/types";
import {
  isEqual,
  isNotEqual,
  varUndefinedOrNull,
  not,
  inputIsNotEmpty,
  inputIsEmpty,
  varEqual,
  varInArray,
  inputIsEqual,
  varSizeEquals
} from "hull-connector-framework/src/purplefusion/conditionals";

import {
  serviceUserTransforms
} from "hull-connector-framework/src/purplefusion/transform-predefined";

import {
  HullIncomingAccount,
  HullIncomingUser,
  HullConnectorAttributeDefinition,
  HullIncomingEvent,
  HullUserIdentity
} from "hull-connector-framework/src/purplefusion/hull-service-objects";
import {
  IntercomCompanyRead,
  IntercomUserRead,
  IntercomLeadRead,
  IntercomWebhookUserRead,
  IntercomWebhookLeadRead,
  IntercomWebhookCompanyRead,
  IntercomIncomingAttributeDefinition,
  IntercomOutgoingAttributeDefinition,
  IntercomWebhookLeadEventRead,
  IntercomWebhookUserEventRead,
  IntercomWebhookEventRead,
  IntercomDeletedUserRead
} from "./service-objects";

const _ = require("lodash");

const webhookTransformation = {
  companyTraits: [
    "{\n" +
    "    \"id\": id,\n" +
    "    \"website\": website,\n" +
    "    \"company_id\": company_id,\n" +
    "    \"name\": name,\n" +
    "    \"user_count\": user_count,\n" +
    "    \"session_count\": session_count,\n" +
    "    \"monthly_spend\": monthly_spend,\n" +
    "    \"last_request_at\": $boolean(last_request_at) ? $ceil($toMillis(last_request_at) / 1000) : null,\n" +
    "    \"created_at\": $boolean(created_at) ? $ceil($toMillis(created_at) / 1000) : null,\n" +
    "    \"updated_at\": $boolean(updated_at) ? $ceil($toMillis(updated_at) / 1000) : null,\n" +
    "    \"custom_attributes\": custom_attributes\n" +
    "}"
  ],
  contactTraits: [
    "{\n" +
    "    \"external_id\": user_id,\n" +
    "    \"id\": id,\n" +
    "    \"email\": email,\n" +
    "    \"name\": name,\n" +
    "    \"avatar\": avatar.image_url,\n" +
    "    \"phone\": phone,\n" +
    "    \"last_request_at\": $boolean(last_request_at) ? $ceil($toMillis(last_request_at) / 1000) : null,\n" +
    "    \"created_at\": $boolean(created_at) ? $ceil($toMillis(created_at) / 1000) : null,\n" +
    "    \"signed_up_at\": $boolean(signed_up_at) ? $ceil($toMillis(signed_up_at) / 1000) : null,\n" +
    "    \"updated_at\": $boolean(updated_at) ? $ceil($toMillis(updated_at) / 1000) : null,\n" +
    "    \"owner_id\": owner_id,\n" +
    "    \"has_hard_bounced\": has_hard_bounced,\n" +
    "    \"custom_attributes\": custom_attributes,\n" +
    "    \"location\": {\n" +
    "        \"type\": location_data.type,\n" +
    "        \"country\": location_data.country_name,\n" +
    "        \"region\": location_data.region_name,\n" +
    "        \"city\": location_data.city_name\n" +
    "    },\n" +
    "    \"social_profiles\": {\n" +
    "        \"type\": social_profiles.type,\n" +
    "        \"data\": social_profiles.social_profiles\n" +
    "    },\n" +
    "    \"companies\": {\n" +
    "        \"type\": companies.type,\n" +
    "        \"data\": companies.companies\n" +
    "    },\n" +
    "    \"tags\": {\n" +
    "        \"type\": tags.type,\n" +
    "        \"data\": tags.tags\n" +
    "    }\n" +
    "}"
  ],
  contactEvent: [

  ]
}

function contactIdentityTransformation({ entityType }) {
  return [
    {
      operateOn: `\${connector.private_settings.${entityType}_claims}`,
      expand: { valueName: "mapping" },
      then: {
        operateOn: { component: "input", select: "${mapping.service}", name: "serviceValue" },
        condition: not(varUndefinedOrNull("serviceValue")),
        writeTo: {
          path: "${mapping.hull}"
        }
      }
    },
    {
      operateOn: { component: "input", select: "id" },
      then:[
        { writeTo: { path: "anonymous_id", format: `\${service_name}-${entityType}:${entityType}-\${operateOn}` } }
      ]
    }
  ]
}
// TODO clean this up
function contactTransformation({ entityType }) {
  return [
    {
      operateOn: `\${connector.private_settings.incoming_${entityType}_attributes}`,
      expand: { valueName: "mapping" },
      then: [
        {
          condition: [
            inputIsNotEmpty("email"),
            varEqual("mapping.service", "email"),
          ],
          operateOn: { component: "input", select: "${mapping.service}", name: "serviceValue" },
          then: [
            {
              writeTo: { path: "attributes.${mapping.hull}", format: { operation: "set", value: "${operateOn}" } }
            }
          ]
        },
        {
          condition: [
            inputIsNotEmpty("tags.data"),
            varEqual("mapping.service", "tags"),
          ],
          then: [
            {
              operateOn: { component: "glue", route: "getContactTags", name: "contactTags" },
              writeTo: { path: "attributes.${mapping.hull}.operation", value: "set" },
              expand: { valueName: "contactTag" },
              then: [
                {
                  writeTo: {
                    path: "attributes.${mapping.hull}.value",
                    appendToArray: "unique",
                    format: "${contactTag.name}"
                  }
                }
              ]
            }
          ]
        },
        {
          condition: [
            inputIsNotEmpty("companies.data"),
            inputIsEqual("companies.type", "list"),
            varEqual("mapping.service", "companies"),
          ],
          then: [
            {
              operateOn: { component: "glue", route: "getContactCompanies", name: "contactCompanies" },
              writeTo: { path: "attributes.${mapping.hull}.operation", value: "set" },
              expand: { valueName: "contactCompany" },
              then: [
                {
                  writeTo: {
                    path: "attributes.${mapping.hull}.value",
                    appendToArray: "unique",
                    format: "${contactCompany.name}"
                  },
                  then: [
                    {
                      condition: [
                        "connector.private_settings.link_users_in_hull",
                        varSizeEquals("contactCompanies", 1)
                      ],
                      writeTo: { path: "accountIdent.anonymous_id", format: "intercom:${contactCompany.id}" }
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          condition: [
            inputIsNotEmpty("companies.data"),
            inputIsEqual("companies.type", "company.list"),
            varEqual("mapping.service", "companies"),
          ],
          then: [
            {
              operateOn: { component: "input", select: "${mapping.service}.data", name: "contactCompany" },
              writeTo: { path: "attributes.${mapping.hull}.operation", value: "set" },
              expand: { valueName: "contactCompany" },
              then: [
                {
                  writeTo: {
                    path: "attributes.${mapping.hull}.value",
                    appendToArray: "unique",
                    format: "${contactCompany.name}"
                  }
                }
              ]
            }
          ]
        },
        {
          condition: [
            varEqual("mapping.service", "segments"),
          ],
          then: [
            {
              operateOn: { component: "glue", route: "getContactSegments", name: "contactSegments" },
              then: [
                {
                  condition: varEqual("contactSegments", []),
                  then: [{
                    writeTo: {
                      path: "attributes.${mapping.hull}",
                      format: { operation: "set", value: [] }
                    }
                  }]
                },
                {
                  condition: not(varEqual("contactSegments", [])),
                  expand: { valueName: "contactSegment" },
                  writeTo: { path: "attributes.${mapping.hull}.operation", value: "set" },
                  then: [
                    {
                      writeTo: {
                        path: "attributes.${mapping.hull}.value",
                        appendToArray: "unique",
                        format: "${contactSegment.name}"
                      }
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          condition: [
            inputIsNotEmpty("social_profiles.data"),
            varEqual("mapping.service", "social_profiles"),
          ],
          then: [
            {
              operateOn: { component: "input", select: "${mapping.service}.data", name: "profiles" },
              expand: { valueName: "profile" },
              then: {
                writeTo: {
                  path: "/${profile.name}_url",
                  format: { operation: "set", value: "${profile.url}" },
                  pathFormatter: (path) => `attributes.intercom_${entityType}` + path.toLowerCase()
                },
                then: {
                  writeTo: { path: "attributes.${mapping.hull}.operation", value: "set" },
                  then: {
                    writeTo: {
                      path: "attributes.${mapping.hull}.value",
                      appendToArray: "unique",
                      format: "${profile.url}"
                    }
                  }
                }
              }
            },
          ]
        },
        {
          condition: [inputIsEmpty("tags.data"), varEqual("mapping.service", "tags")],
          then: [{
            writeTo: {
              path: "attributes.${mapping.hull}",
              format: { operation: "set", value: [] }
            }
          }]
        },
        {
          condition: [inputIsEmpty("companies.data"), varEqual("mapping.service", "companies")],
          then: [
            {
              writeTo: {
                path: "attributes.${mapping.hull}",
                format: { operation: "set", value: [] }
              }
            }
          ]
        },
        {
          condition: [inputIsEmpty("social_profiles.data"), varEqual("mapping.service", "social_profiles")],
          then: [{
            writeTo: {
              path: "attributes.${mapping.hull}",
              format: { operation: "set", value: [] }
            }
          }]
        }
      ]
    },
    {
      operateOn: { component: "input", select: "lead_converted" },
      condition: not(varUndefinedOrNull("operateOn")),
      writeTo: { path: "attributes.intercom_lead/lead_converted", format: { operation: "set", value: "${operateOn}" } }
    }
  ];
}

function eventTransformation() {
  return [
    { writeTo: { path: "eventName", value: "${eventName}" } },
    { writeTo: { path: "context.source", value: "${eventSource}" } },
    { writeTo: { path: "properties.topic", value: "${webhookTopic}" } },
    {
      operateOn: { component: "input", select: "created_at" },
      writeTo: {
        path: "context.created_at",
        value: "${operateOn}"
      }
    },
    {
      operateOn: { component: "input", name: "event" },
      writeTo: {
        path: "context.event_id",
        formatter: (event) => {
          // TODO fix this
          const id = _.get(event, "data.item.contact.id",
            _.get(event, "data.item.user.id",
            _.get(event, "data.item.id")))
          return [id, event.topic, event.created_at].join("-")
        }
      }
    },
    {
      operateOn: "${propertiesMapping}",
      expand: { keyName: "hullAttribute", valueName: "intercomPath" },
      then: {
        operateOn: { component: "input", select: "${intercomPath}", name: "serviceValue" },
        condition: not(varUndefinedOrNull("serviceValue")),
        writeTo: {
          path: "properties.${hullAttribute}",
          value: "${operateOn}"
        }
      }
    },
    {
      operateOn: "${contextMapping}",
      expand: { keyName: "hullAttribute", valueName: "intercomPath" },
      then: {
        operateOn: { component: "input", select: "${intercomPath}", name: "serviceValue" },
        condition: not(varUndefinedOrNull("serviceValue")),
        writeTo: {
          path: "context.${hullAttribute}",
          value: "${operateOn}"
        }
      }
    }
  ];
}

const transformsToService: ServiceTransforms = [
  {
    input: IntercomIncomingAttributeDefinition,
    output: HullConnectorAttributeDefinition,
    strategy: "Jsonata",
    direction: "incoming",
    batchTransform: true,
    transforms: [
      `$.{ "type": data_type, "name": full_name, "display": label, "readOnly": $not(api_writable) }`
    ]
  },
  {
    input: IntercomOutgoingAttributeDefinition,
    output: HullConnectorAttributeDefinition,
    strategy: "Jsonata",
    direction: "incoming",
    batchTransform: true,
    transforms: [
      `$.{ "type": data_type, "name": name, "display": label, "readOnly": $not(api_writable) }`
    ]
  },
  {
    input: IntercomLeadRead,
    output: HullIncomingUser,
    direction: "incoming",
    strategy: "AtomicReaction",
    target: { component: "new" },
    then: _.concat(
      serviceUserTransforms({ entityType: "lead", attributeExclusions: ["email", "tags", "companies", "segments", "social_profiles"] }),
      contactTransformation({ entityType: "lead" })
    )
  },
  {
    input: IntercomUserRead,
    output: HullIncomingUser,
    direction: "incoming",
    strategy: "AtomicReaction",
    target: { component: "new" },
    then: _.concat(
      serviceUserTransforms({ entityType: "user", attributeExclusions: ["email", "tags", "companies", "segments", "social_profiles"] }),
      contactTransformation({ entityType: "user" })
    )
  },
  {
    input: IntercomWebhookUserRead,
    output: IntercomUserRead,
    direction: "incoming",
    strategy: "Jsonata",
    transforms: webhookTransformation["contactTraits"]
  },
  {
    input: IntercomWebhookLeadRead,
    output: IntercomLeadRead,
    direction: "incoming",
    strategy: "Jsonata",
    transforms: webhookTransformation["contactTraits"]
  },
  {
    input: IntercomWebhookCompanyRead,
    output: IntercomCompanyRead,
    direction: "incoming",
    strategy: "Jsonata",
    transforms: webhookTransformation["companyTraits"]
  },
  {
    input: IntercomWebhookLeadEventRead,
    output: HullUserIdentity,
    direction: "incoming",
    strategy: "AtomicReaction",
    target: { component: "new" },
    then: contactIdentityTransformation({ entityType: "lead" })
  },
  {
    input: IntercomWebhookUserEventRead,
    output: HullUserIdentity,
    direction: "incoming",
    strategy: "AtomicReaction",
    target: { component: "new" },
    then: contactIdentityTransformation({ entityType: "user" })
  },
  {
    input: IntercomWebhookEventRead,
    output: HullIncomingEvent,
    direction: "incoming",
    strategy: "AtomicReaction",
    target: { component: "new" },
    then: eventTransformation()
  },
  {
    input: IntercomDeletedUserRead,
    output: HullIncomingUser,
    direction: "incoming",
    strategy: "AtomicReaction",
    target: { component: "new" },
    then: [
      {
        operateOn: { component: "input", select: "data.item.id" },
        writeTo: {
          path: "ident.anonymous_id",
          value: "intercom-user:user-${operateOn}"
        }
      },
      {
        operateOn: { component: "input", select: "created_at" },
        writeTo: {
          path: "attributes.intercom_user/deleted_at",
          value: "${operateOn}"
        }
      }
    ]
  },

  // TODO clean this up a lot
  {
    input: IntercomCompanyRead,
    output: HullIncomingAccount,
    direction: "incoming",
    strategy: "AtomicReaction",
    target: { component: "new" },
    then: [
      {
        operateOn: "${connector.private_settings.incoming_account_attributes}",
        expand: { valueName: "mapping" },
        then: [
          {
            operateOn: { component: "input", select: "${mapping.service}", name: "serviceValue"},
            condition: [
              not(varInArray("mapping.service", ["tags", "segments"])),
              isNotEqual("serviceValue", undefined)
            ],
            then: [
              {
                condition: isEqual("mapping.overwrite", false),
                writeTo: { path: "attributes.${mapping.hull}", format: { operation: "setIfNull", value: "${operateOn}" } }
              },
              {
                condition: isEqual("mapping.overwrite", true),
                writeTo: { path: "attributes.${mapping.hull}", format: { operation: "set", value: "${operateOn}" } }
              }
            ]
          },
          {
            condition: isEqual("mapping.service", "tags"),
            then: [
              {
                operateOn: { component: "input", select: "tags.tags", name: "companyTags" },
                condition: [
                  not(varUndefinedOrNull("companyTags"))
                ],
                then: [
                  { writeTo: { path: "attributes.${mapping.hull}.operation", value: "set" } }
                ]
              },
              {
                operateOn: { component: "input", select: "tags.tags", name: "companyTags" },
                expand: { valueName: "companyTag" },
                condition: [
                  not(varEqual("companyTags", []))
                ],
                then: [
                  {
                    writeTo: {
                      path: "attributes.${mapping.hull}.value",
                      appendToArray: "unique",
                      format: "${companyTag.name}",
                    }
                  }
                ]
              },
              {
                operateOn: { component: "input", select: "tags.tags", name: "companyTags" },
                writeTo: { path: "attributes.${mapping.hull}.operation", value: "set" } ,
                condition: [
                  varEqual("companyTags", [])
                ],
                then: [
                  { writeTo: { path: "attributes.${mapping.hull}", format: { "operation": "set", "value": [] } } }
                ]
              }
            ]
          },
          {
            condition: [
              varEqual("mapping.service", "segments"),
            ],
            then: [
              {
                operateOn: { component: "glue", route: "getCompanySegments", name: "companySegments" },
                condition: not(varUndefinedOrNull("companySegments")),
                then: [
                  {
                    condition: varEqual("companySegments", []),
                    then: [{ writeTo: { path: "attributes.${mapping.hull}", format: { operation: "set", value: [] } } }]
                  },
                  {
                    condition: not(varEqual("companySegments", [])),
                    expand: { valueName: "companySegment" },
                    writeTo: { path: "attributes.${mapping.hull}.operation", value: "set" } ,
                    then: [
                      {
                        writeTo: {
                          path: "attributes.${mapping.hull}.value",
                          appendToArray: "unique",
                          format: "${companySegment.name}"
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        operateOn: "${connector.private_settings.account_claims}",
        expand: { valueName: "mapping" },
        then: {
          operateOn: { component: "input", select: "${mapping.service}"},
          condition: not(varUndefinedOrNull("operateOn")),
          writeTo: { path: "ident.${mapping.hull}" }
        }
      },
      {
        operateOn: { component: "input", select: "id" },
        then:[
          { writeTo: { path: "ident.anonymous_id", format: "${service_name}:${operateOn}" } },
          { writeTo: { path: "attributes.${service_name}/id", format: { operation: "set", value: "${operateOn}" } } }
        ]
      },
      {
        operateOn: { component: "input", select: "name" },
        condition: not(varUndefinedOrNull("operateOn")),
        writeTo: { path: "attributes.name", format: { operation: "setIfNull", value: "${operateOn}" } }
      }
    ]
  }
];

module.exports = transformsToService;

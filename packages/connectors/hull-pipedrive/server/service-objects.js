/* @flow */

import type { ServiceObjectDefinition } from "hull-connector-framework/src/purplefusion/types";

const PipedrivePersonRead: ServiceObjectDefinition = {
  service_name: "pipedrive_incoming_person",
  name: "Person"
};

const PipedrivePersonWrite: ServiceObjectDefinition = {
  service_name: "outreach_outgoing_person",
  name: "Person"
};

const PipedriveOrgRead: ServiceObjectDefinition = {
  service_name: "outreach_incoming_org",
  name: "Org"
};

const PipedriveOrgWrite: ServiceObjectDefinition = {
  service_name: "outreach_outgoing_org",
  name: "Org"
};

module.exports = {
  PipedrivePersonRead,
  PipedrivePersonWrite,
  PipedriveOrgWrite,
  PipedriveOrgRead
};

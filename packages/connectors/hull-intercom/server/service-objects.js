/* @flow */

import type { ServiceObjectDefinition } from "hull-connector-framework/src/purplefusion/types";

const IntercomCompanyRead: ServiceObjectDefinition = {
  service_name: "intercom_company_read",
  name: "Company"
};

const IntercomCompanyWrite: ServiceObjectDefinition = {
  service_name: "intercom_company_write",
  name: "Company"
};

const IntercomUserRead: ServiceObjectDefinition = {
  service_name: "intercom_user_read",
  name: "User"
};

const IntercomLeadRead: ServiceObjectDefinition = {
  service_name: "intercom_lead_read",
  name: "Lead"
};

const IntercomUserWrite: ServiceObjectDefinition = {
  service_name: "intercom_user_write",
  name: "User"
};

const IntercomLeadWrite: ServiceObjectDefinition = {
  service_name: "intercom_lead_write",
  name: "Lead"
};

const IntercomEventWrite: ServiceObjectDefinition = {
  service_name: "intercom_event_write",
  name: "Event"
};

const IntercomAttributeWrite: ServiceObjectDefinition = {
  service_name: "intercom_attribute_write",
  name: "IntercomAttribute"
};

const IntercomAttributeRead: ServiceObjectDefinition = {
  service_name: "intercom_attribute_read",
  name: "IntercomAttribute"
};

const IntercomIncomingAttributeDefinition: ServiceObjectDefinition = {
  service_name: "intercom_incoming_attribute_definition",
  name: "IntercomIncomingAttributeDefinition"
};

const IntercomOutgoingAttributeDefinition: ServiceObjectDefinition = {
  service_name: "intercom_outgoing_attribute_definition",
  name: "IntercomOutgoingAttributeDefinition"
};

const IntercomAttributeMapping: ServiceObjectDefinition = {
  service_name: "intercom_attribute_mapping",
  name: "IntercomAttributeMapping"
};

const IntercomWebhookLeadRead: ServiceObjectDefinition = {
  service_name: "intercom_webhook_lead_read",
  name: "Lead"
};

const IntercomWebhookUserRead: ServiceObjectDefinition = {
  service_name: "intercom_webhook_user_read",
  name: "User"
};

const IntercomWebhookCompanyRead: ServiceObjectDefinition = {
  service_name: "intercom_webhook_company_read",
  name: "Company"
};

const IntercomWebhookLeadEventRead: ServiceObjectDefinition = {
  service_name: "intercom_webhook_lead_event_read",
  name: "Lead"
};

const IntercomWebhookUserEventRead: ServiceObjectDefinition = {
  service_name: "intercom_webhook_user_event_read",
  name: "Lead"
};

const IntercomWebhookEventRead: ServiceObjectDefinition = {
  service_name: "intercom_webhook_event_read",
  name: "Event"
};

const IntercomWebhookConversationEventRead: ServiceObjectDefinition = {
  service_name: "intercom_webhook_conversation_event_read",
  name: "Conversation"
};

const IntercomDeletedUserRead: ServiceObjectDefinition = {
  service_name: "intercom_deleted_user_read",
  name: "User"
};

module.exports = {
  IntercomCompanyRead,
  IntercomCompanyWrite,
  IntercomUserRead,
  IntercomLeadRead,
  IntercomUserWrite,
  IntercomLeadWrite,
  IntercomEventWrite,
  IntercomIncomingAttributeDefinition,
  IntercomOutgoingAttributeDefinition,
  IntercomAttributeWrite,
  IntercomAttributeRead,
  IntercomAttributeMapping,
  IntercomWebhookLeadRead,
  IntercomWebhookUserRead,
  IntercomWebhookCompanyRead,
  IntercomWebhookLeadEventRead,
  IntercomWebhookUserEventRead,
  IntercomWebhookConversationEventRead,
  IntercomWebhookEventRead,
  IntercomDeletedUserRead
};

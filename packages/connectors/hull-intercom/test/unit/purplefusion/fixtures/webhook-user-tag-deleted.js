module.exports = {
  "configuration": {
    "id": "5c092905c36af496c700012e",
    "secret": "shhh",
    "organization": "organization.hullapp.io",
    "hostname": "connectortest.connectordomain.io",
    "clientCredentialsEncryptedToken": "shhhclientCredentialsEncryptedToken",
    "private_settings": {
      "webhook_id": "1",
      "receive_events": true,
      "user_claims": [
        { "hull": 'email', "service": 'email' }
      ],
      "incoming_events": [
        'user.tag.deleted'
      ],
      "incoming_user_attributes": [
        { "service": "tags", "hull": "intercom_user/tags", "overwrite": true }
      ]
    }
  },
  "route": "webhooks",
  "input": { "body": {
      "type": "notification_event",
      "app_id": "lkqcyt9t",
      "data": {
        "type": "notification_event_data",
        "item": {
          "type": "user_tag",
          "user": {
            "type": "user",
            "id": "5ee3d479d1cf3dedbee23d68",
            "user_id": "234523452345345",
            "anonymous": false,
            "email": "bob.dylan@rei.com",
            "phone": null,
            "name": "Bob Dylan",
            "pseudonym": null,
            "avatar": {
              "type": "avatar",
              "image_url": null
            },
            "app_id": "lkqcyt9t",
            "companies": {
              "type": "company.list",
              "companies": [
                {
                  "type": "company",
                  "company_id": "5f187aa44fd1ce23c1cf25f8-qualification-company",
                  "id": "5f187aa44fd1ce23c1cf25f7",
                  "name": "Sony"
                }
              ]
            },
            "location_data": {},
            "last_request_at": null,
            "created_at": "2020-06-12T19:16:09.076+00:00",
            "remote_created_at": null,
            "signed_up_at": null,
            "updated_at": "2020-08-05T13:24:40.258+00:00",
            "session_count": 0,
            "social_profiles": {
              "type": "social_profile.list",
              "social_profiles": []
            },
            "owner_id": null,
            "unsubscribed_from_emails": false,
            "marked_email_as_spam": false,
            "has_hard_bounced": false,
            "tags": {
              "type": "tag.list",
              "tags": [
                {
                  "type": "tag",
                  "id": "4390216"
                },
                {
                  "type": "tag",
                  "id": "4390215"
                }
              ]
            },
            "segments": {
              "type": "segment.list",
              "segments": []
            },
            "custom_attributes": {
              "c_domain": "rei.com",
              "job_title": "software"
            },
            "referrer": null,
            "utm_campaign": null,
            "utm_content": null,
            "utm_medium": null,
            "utm_source": null,
            "utm_term": null,
            "do_not_track": null,
            "last_seen_ip": "123",
            "user_agent_data": null
          },
          "tag": {
            "type": "tag",
            "id": "4399420",
            "name": "NewCompany"
          },
          "created_at": 1596633880,
          "admin": {
            "type": "admin"
          }
        }
      },
      "links": {},
      "id": "notif_31345d83-849c-4894-8996-62f302034077",
      "topic": "user.tag.deleted",
      "delivery_status": "pending",
      "delivery_attempts": 1,
      "delivered_at": 0,
      "first_sent_at": 1596633880,
      "created_at": 1596633880,
      "self": null
    }
  },
  "serviceRequests": [
    {
      "localContext": expect.anything(),
      "name": "intercom",
      "op": "getAllTags",
      "result": {
        "body": {
          "type": "list",
          "data": []
        }
      }
    },
    {
      "localContext": expect.anything(),
      "name": "intercom",
      "op": "getContactTags",
      "result": {
        "body": {
          "type": "list",
          "data": [
            { "type": "tag", "id": "4406234", "name": "Tag1" },
            { "type": "tag", "id": "4406229", "name": "Tag2" }
          ]
        }
      }
    },
    {
      "localContext": expect.anything(),
      "name": "hull",
      "op": "asUser",
      "input": {
        "ident": {
          "email": "bob.dylan@rei.com",
          "anonymous_id": "intercom-user:user-5ee3d479d1cf3dedbee23d68"
        },
        "attributes": {
          "name": {
            "operation": "setIfNull",
            "value": "Bob Dylan"
          },
          "intercom_user/id": {
            "operation": "set",
            "value": "5ee3d479d1cf3dedbee23d68"
          },
          "intercom_user/tags": {
            "value": [
              "Tag1",
              "Tag2"
            ],
            "operation": "set"
          }
        }
      },
      "result": {}
    }
  ],
  "result": expect.anything()
}

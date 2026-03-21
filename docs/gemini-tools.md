# Gemini Function Tools

> Registered with the Gemini Live API for mid-conversation function calling

---

## Tool Definitions

### search_maintenance_history

Search property maintenance history for similar past issues using vector similarity.

```json
{
  "name": "search_maintenance_history",
  "description": "Search property maintenance history for similar past issues",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Description of the issue to search for"
      },
      "property_id": {
        "type": "string",
        "description": "Property UUID"
      }
    },
    "required": ["query", "property_id"]
  }
}
```

---

### create_incident

Create a new maintenance incident in the system.

```json
{
  "name": "create_incident",
  "description": "Create a new maintenance incident",
  "parameters": {
    "type": "object",
    "properties": {
      "property_id": { "type": "string" },
      "unit_id": { "type": "string" },
      "category": {
        "type": "string",
        "enum": ["plumbing", "electrical", "hvac", "appliance", "structural"]
      },
      "description": { "type": "string" },
      "urgency": {
        "type": "string",
        "enum": ["low", "medium", "high", "emergency"]
      },
      "guest_phone": { "type": "string" }
    },
    "required": ["property_id", "category", "description", "urgency"]
  }
}
```

---

### log_vendor_quote

Record a vendor's quote for an incident.

```json
{
  "name": "log_vendor_quote",
  "description": "Record a vendor's quote for an incident",
  "parameters": {
    "type": "object",
    "properties": {
      "incident_id": { "type": "string" },
      "vendor_id": { "type": "string" },
      "amount": { "type": "number" },
      "eta_days": { "type": "number" },
      "notes": { "type": "string" }
    },
    "required": ["incident_id", "vendor_id", "amount", "eta_days"]
  }
}
```

---

### get_vendor_access_code

Retrieve the vendor door access code for a property. Only provide to verified scheduled vendors.

```json
{
  "name": "get_vendor_access_code",
  "description": "Retrieve the vendor door access code for a property. Only provide to verified scheduled vendors.",
  "parameters": {
    "type": "object",
    "properties": {
      "property_id": {
        "type": "string"
      },
      "vendor_phone": {
        "type": "string",
        "description": "Caller's phone to verify against scheduled vendor"
      }
    },
    "required": ["property_id"]
  }
}
```

---

### schedule_repair

Schedule a repair by creating a calendar event and updating the incident.

```json
{
  "name": "schedule_repair",
  "description": "Schedule a repair by creating a calendar event and updating the incident",
  "parameters": {
    "type": "object",
    "properties": {
      "incident_id": { "type": "string" },
      "vendor_id": { "type": "string" },
      "scheduled_date": {
        "type": "string",
        "description": "ISO date string"
      },
      "time_preference": {
        "type": "string",
        "enum": ["morning", "afternoon", "evening"]
      }
    },
    "required": ["incident_id", "vendor_id", "scheduled_date"]
  }
}
```

---

### update_incident_status

Update the status of an incident as it progresses through the workflow.

```json
{
  "name": "update_incident_status",
  "description": "Update the status of an incident",
  "parameters": {
    "type": "object",
    "properties": {
      "incident_id": { "type": "string" },
      "status": {
        "type": "string",
        "enum": ["triaging", "quoting", "pending_approval", "approved", "scheduled", "in_progress", "resolved"]
      }
    },
    "required": ["incident_id", "status"]
  }
}
```

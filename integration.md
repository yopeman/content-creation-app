# External Projects Integration API

This document provides a comprehensive guide for connecting external projects/services with the Content Creation Platform.

---

## 1. Overview & Architecture

The Integration API allows external systems (bots, web apps, CRMs, automation pipelines) to:
1. **Auto-provision / authenticate users** seamlessly via email.
2. **Push content drafts or ready-to-dispatch media** directly into the platform.
3. **Receive a direct one-time secure claim link (`view_url`)** that:
   - Authenticates the user in the browser via JWT.
   - Prompts new users to set an initial password and connect an active channel (e.g., Telegram).
   - Directs them directly to the content editor (`/contents/{content_id}`) or dashboard home (`/`).

## 2. Authentication (Server-to-Server)

All ingestion endpoints require an API Key. Provide it in one of the following HTTP headers:

- **`X-API-Key: <YOUR_INTEGRATION_API_KEY>`** (Recommended)
- **`Authorization: Bearer <YOUR_INTEGRATION_API_KEY>`**

> Set `INTEGRATION_API_KEY` in `backend/.env`.

---

## 3. Endpoints Reference

### 3.1 Ingest Content & Provision User

- **Method:** `POST`
- **Paths:**
  - `/api/v1/integrations/contents`
  - `/api/v1/integrations/content`
  - `/api/v1/integrations/users`
  - `/api/v1/integrations/user`

#### Request Payload Structure

```typescript
{
  name?: string;                 // User's display name (optional)
  email: string;                 // User's email (required, unique identifier)
  content?: {                    // Optional. If omitted, links to "/"
    title: string;               // Content title
    status?: "draft" | "published" | "scheduled" | "archived"; // default: "draft"
    details?: Array<{
      type: "text" | "image" | "video" | "audio" | "document";
      path?: string;             // URL or storage path for media
      text?: string;             // Text content or caption
      order?: number;            // Display order (default: 1)
      mime_type?: string;        // e.g. "image/png"
    }>;
  };
}
```

---

### 3.2 Use Cases & Examples

#### Case A: Ingest User + Content (Post/Draft)
When you want to create a new draft post for the user and open the content editor:

**Request:**
```bash
curl -X POST "http://localhost:8000/api/v1/integrations/contents" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_integration_api_key_here" \
  -d '{
    "name": "Yope Man",
    "email": "yope@example.com",
    "content": {
      "title": "Announcing our new product update!",
      "status": "draft",
      "details": [
        {
          "type": "text",
          "text": "Check out our latest release notes...",
          "order": 1
        },
        {
          "type": "image",
          "path": "https://example.com/assets/banner.png",
          "order": 2
        }
      ]
    }
  }'
```

**Response (`201 Created`):**
```json
{
  "content_id": "674601dfa12b4e8590d9a101",
  "user_id": "674601dfa12b4e8590d9a100",
  "is_new_user": true,
  "claim_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "view_url": "http://localhost:3000/contents/674601dfa12b4e8590d9a101?claim_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### Case B: Ingest User Only (No Content)
When an external app only wants to register/authenticate the user and send them directly to the main dashboard:

**Request:**
```bash
curl -X POST "http://localhost:8000/api/v1/integrations/contents" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_integration_api_key_here" \
  -d '{
    "name": "Yope Man",
    "email": "yope@example.com"
  }'
```

**Response (`201 Created`):**
```json
{
  "content_id": null,
  "user_id": "674601dfa12b4e8590d9a100",
  "is_new_user": true,
  "claim_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "view_url": "http://localhost:3000/?claim_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

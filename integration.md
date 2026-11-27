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


---

## 4. Frontend Claim Ticket Exchange & Onboarding

### 4.1 Ticket Claiming

When the user opens `view_url`, the frontend intercepts the `claim_token` query parameter and immediately exchanges it:

- **Endpoint:** `POST /api/v1/integrations/claim-ticket`
- **Request Body:**
  ```json
  {
    "claim_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Response:**
  ```json
  {
    "access_token": "bearer_jwt_access_token_here",
    "token_type": "bearer",
    "user": {
      "id": "674601dfa12b4e8590d9a100",
      "email": "yope@example.com",
      "name": "Yope Man",
      "needs_password": true,
      "status": "active"
    },
    "content_id": "674601dfa12b4e8590d9a101",
    "onboarding": {
      "needs_password": true,
      "has_connected_channel": false
    }
  }
  ```

### 4.2 Onboarding Workflow

When the user enters through `view_url` (`claim_token`), the Quick-Start Onboarding Wizard handles any incomplete configuration:

- **If the user already has at least one active connected channel AND already has a password set**: The modal is hidden completely and the user directly accesses their dashboard or content.
- **If the user already has an active channel but needs to set an initial password**: The wizard only prompts for **Step 1: Set Password** and then finishes immediately (`Open Dashboard` / `Open Content`).
- **If the user has NO active connected channel**: The wizard guides them through setting a password (if `needs_password == true`) and then **Connect Telegram Channel** (`POST /api/v1/platforms/tg`).
  - Telegram uses the system default bot token configured in backend `.env` (`DEFAULT_TELEGRAM_BOT_TOKEN`).
  - The user only needs to provide their Telegram `Chat ID` (e.g. `@channelname` or numerical ID `-100...`).

---

## 5. Environment Configuration

Add the following variables to `backend/.env`:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `INTEGRATION_API_KEY` | Secret key used for authenticating external project requests | `your-secure-random-secret-key-32chars` |
| `FRONTEND_URL` | Base URL of frontend used to construct `view_url` | `http://localhost:3000` |
| `DEFAULT_TELEGRAM_BOT_TOKEN` | Default Telegram bot token used for zero-token channel links | `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ` |
| `JWT_SECRET_KEY` | Secret key for signing access and claim tokens | `your-jwt-secret-key` |
| `CLAIM_TOKEN_EXPIRE_HOURS` | Lifetime of the one-time claim token | `24` |

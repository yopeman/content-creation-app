# Deploying Yope on Vercel as Two Separate Apps

This monorepo is configured for seamless deployment on Vercel into two separate applications:
1. **Backend (FastAPI Python Serverless App)**
2. **Frontend (Next.js 16 App)**

---

## 1. Deploy the Backend App

### Step 1: Create New Project in Vercel
1. In your Vercel Dashboard, click **Add New...** -> **Project**.
2. Select your Git repository.
3. In the configuration dialog:
   - **Project Name**: e.g., `yope-backend` (or your preferred name).
   - **Framework Preset**: **Other**.
   - **Root Directory**: Click *Edit* and select **`backend`**.

### Step 2: Configure Environment Variables
Add the following environment variables in the Vercel project settings:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `MONGODB_URL` | Remote MongoDB connection string (e.g., MongoDB Atlas) | `mongodb+srv://<user>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority` |
| `DATABASE_NAME` | Database name | `content_creation_db` |
| `SECRET_KEY` | Secure secret key for signing JWT tokens | `<random-32-byte-hex-string>` |
| `ENCRYPTION_KEY` | Encryption key for platform secrets | `<random-secret-key>` |
| `FRONTEND_URL` | Your frontend's Vercel deployment URL | `https://yope-frontend.vercel.app` |
| `BACKEND_CORS_ORIGINS` | Allowed origins (can be comma-separated or `*`) | `https://yope-frontend.vercel.app,http://localhost:3000` |
| `DEFAULT_TELEGRAM_BOT_TOKEN` | (Optional) System bot token for zero-token links | `123456789:ABCdefGHI...` |
| `INTEGRATION_API_KEY` | Secret key for external project ingestion API | `<random-secret-key>` |
| `GROQ_API_KEY` | (Optional) Groq API key for AI generation | `gsk_...` |
| `GROQ_MODEL` | (Optional) Model name | `openai/gpt-oss-120b` |
| `CRON_SECRET` | (Optional) Secret key to secure Vercel Cron requests | `<random-secret-key>` |

### Step 3: Deploy
Click **Deploy**.
Once deployed, copy your backend production domain (e.g., `https://yope-backend.vercel.app`).

> **Note on Background Scheduling & Worker**:
> Because Vercel functions are serverless and ephemeral, continuous `while True` polling loops do not run 24/7.
> Instead, `backend/vercel.json` configures a **Vercel Cron Job** (`* * * * *`) that triggers `/api/v1/posts/cron-dispatch` every minute to process due scheduled posts automatically.

---

## 2. Deploy the Frontend App

### Step 1: Create New Project in Vercel
1. In your Vercel Dashboard, click **Add New...** -> **Project**.
2. Select the **same** Git repository.
3. In the configuration dialog:
   - **Project Name**: e.g., `yope-frontend`.
   - **Framework Preset**: **Next.js** (detected automatically).
   - **Root Directory**: Click *Edit* and select **`frontend`**.

### Step 2: Configure Environment Variables
Add the backend URL pointing to your deployed backend from Section 1:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Base API URL including `/api/v1` | `https://yope-backend.vercel.app/api/v1` |
| `NEXT_PUBLIC_BACKEND_URL` | Base backend root URL | `https://yope-backend.vercel.app` |

### Step 3: Deploy
Click **Deploy**.

---

## 3. Post-Deployment Verification

1. **Verify Backend Health**:
   Open `https://yope-backend.vercel.app/api/v1/health` in your browser.
   It should return:
   ```json
   {
     "status": "ok",
     "database": "connected",
     "latency_ms": 12.3
   }
   ```
2. **Verify Frontend**:
   Open `https://yope-frontend.vercel.app`.
   Log in or create a user, and confirm requests successfully reach the backend API.

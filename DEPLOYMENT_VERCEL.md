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
   - **Project Name**: e.g., `yope-backend`.
   - **Framework Preset**: **Other**.
   - **Root Directory**: Click *Edit* and select **`backend`**.
   - Vercel automatically detects `main.py` as the entrypoint function.

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

> **Note on Background Scheduling & Worker on Vercel Hobby**:
> Vercel Hobby (free) accounts restrict built-in Vercel Cron jobs to at most once per day (`0 0 * * *`), which is too infrequent for timely social media publishing.
> To prevent Vercel deployment errors, internal `crons` are omitted from `backend/vercel.json`. Instead, trigger `/api/v1/posts/cron-dispatch` using one of these free alternatives:
>
> 1. **cron-job.org (Recommended - Free & 1-minute interval)**:
>    - Create a free account on [cron-job.org](https://cron-job.org).
>    - Create a new cron job pointing to: `https://<your-backend-app>.vercel.app/api/v1/posts/cron-dispatch`
>    - Method: `POST` (or `GET`)
>    - Execution Schedule: Every 1 minute (or 5 minutes).
>    - If you set `CRON_SECRET` in Vercel, add header: `Authorization: Bearer <your-cron-secret>`.
>
> 2. **GitHub Actions (Free - Included in this repo)**:
>    - A workflow is preconfigured at `.github/workflows/scheduled-posts.yml` running every 5 minutes.
>    - Go to your repository on GitHub -> **Settings** -> **Secrets and variables** -> **Actions**.
>    - Add secret `BACKEND_URL`: `https://<your-backend-app>.vercel.app`
>    - (Optional) Add secret `CRON_SECRET`: matching your backend `CRON_SECRET`.
>
> 3. **Upstash QStash**:
>    - Use Upstash QStash to schedule recurring HTTP requests to the cron endpoint.

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

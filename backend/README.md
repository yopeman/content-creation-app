# Yope Content Creation App Backend

FastAPI asynchronous backend for AI-driven content generation, campaign planning, and multi-platform publishing, powered by **Beanie (Pydantic v2)** and **MongoDB**, managed with the modern **uv** package manager.

---

## Tech Stack
* **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12+)
* **Database & ODM**: [MongoDB](https://www.mongodb.com/) (Local) with [Beanie ODM](https://beanie-odm.dev/) (Motor async driver)
* **Package Manager**: [uv](https://docs.astral.sh/uv/)
* **Local Storage**: Local filesystem (`uploads/`) with static serving (`/uploads/`)
* **Testing**: `pytest` & `pytest-asyncio` with `httpx`

---

## Directory Structure

```text
backend/
├── app/
│   ├── api/
│   │   ├── deps.py              # Current user dependency & auth resolution
│   │   ├── router.py            # Central API v1 router
│   │   └── v1/
│   │       ├── health.py        # System health & MongoDB ping check
│   │       ├── users.py         # User authentication: register, login, & me (protected)
│   │       ├── platforms.py     # Connected social media accounts (TG, FB, YB, TK, IG, LN)
│   │       ├── contents.py      # Content drafts, /upload-media & /generate AI multi-modal agent
│   │       ├── prompts.py       # Prompt history and token execution tracking
│   │       ├── plans.py         # Content campaign plans & plan items
│   │       └── posts.py         # Scheduled posts & per-platform post targets
│   ├── core/
│   │   ├── config.py            # Settings (Pydantic BaseSettings from .env)
│   │   └── security.py          # Password hashing (bcrypt) & JWT token utilities
│   ├── db/
│   │   └── session.py           # Motor client & Beanie document model registration
│   ├── models/                  # Beanie Documents
│   │   ├── enums.py             # UserStatus, PlatformCode, ContentType, etc.
│   │   ├── user.py              # User collection
│   │   ├── platform.py          # Platform collection
│   │   ├── prompt.py            # Prompt collection (LLM generation history)
│   │   ├── content.py           # Content collection & ContentDetail sub-documents
│   │   ├── post.py              # Post collection
│   │   ├── post_target.py       # PostTarget collection (per-platform dispatch)
│   │   ├── plan.py              # Plan collection
│   │   └── plan_item.py         # PlanItem collection
│   ├── schemas/                 # Request & Response DTOs
│   ├── services/
│   │   ├── content_agent.py     # LangChain + Groq multi-modal content generation agent
│   │   ├── content_tools.py     # Pillow image, gTTS audio, MoviePy/ffmpeg video tools
│   │   ├── storage.py           # Local file storage service (aiofiles)
│   │   └── telegram.py          # Telegram Bot API integration & getChat verification
│   └── main.py                  # FastAPI application with async lifespan
├── tests/
│   ├── conftest.py              # Async test fixtures & isolated test database
│   ├── test_api.py              # Integration tests for full creation flows
│   └── test_health.py           # Health and ping verification
├── uploads/                     # Local storage destination for media assets
├── .env.example                 # Environment configuration template
├── pyproject.toml               # uv project configuration and dependencies
└── README.md
```

---

## Quickstart

### 1. Prerequisites
* **Python 3.12+**
* **uv**: `curl -LsSf https://astral.sh/uv/install.sh | sh`
* **Local MongoDB**: Running on `localhost:27017`

### 2. Environment Configuration
Create your `.env` file from `.env.example`:
```bash
cp .env.example .env
```

### 3. Run the Development Server
Launch the server using `uv`:
```bash
uv run uvicorn app.main:app --reload --port 8000
```
Open **[http://localhost:8000/docs](http://localhost:8000/docs)** to view the interactive OpenAPI / Swagger UI.

### 4. Run the Test Suite
```bash
uv run pytest -v
```

---

## Media Upload & Local Storage
Media files uploaded through `POST /api/v1/contents/upload-media` are saved into `uploads/{media_type}/` and served statically at `http://localhost:8000/uploads/{media_type}/{filename}`.

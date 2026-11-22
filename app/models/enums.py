from enum import Enum


class UserStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class PlatformCode(str, Enum):
    TG = "TG"    # Telegram
    FB = "FB"    # Facebook
    YB = "YB"    # YouTube
    TK = "TK"    # TikTok
    IG = "IG"    # Instagram
    LN = "LN"    # LinkedIn


class PlatformStatus(str, Enum):
    CONNECTED = "connected"
    EXPIRED = "expired"
    REVOKED = "revoked"
    ERROR = "error"


class PromptType(str, Enum):
    CONTENT = "content"
    PLAN = "plan"
    PLAN_ITEM = "plan_item"


class PromptStatus(str, Enum):
    PENDING = "pending"
    STREAMING = "streaming"
    DONE = "done"
    FAILED = "failed"


class ContentType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"


class ContentStatus(str, Enum):
    DRAFT = "draft"
    GENERATING = "generating"
    READY = "ready"
    APPROVED = "approved"
    ARCHIVED = "archived"


class PostStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    PARTIAL = "partial"
    FAILED = "failed"


class PostTargetStatus(str, Enum):
    PENDING = "pending"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    FAILED = "failed"
    SKIPPED = "skipped"


class PlanStatus(str, Enum):
    DRAFT = "draft"
    GENERATING = "generating"
    READY = "ready"
    SCHEDULED = "scheduled"
    DONE = "done"
    FAILED = "failed"


class PlanItemStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    READY = "ready"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"

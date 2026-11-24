export type UserStatus = "active" | "suspended";

export interface User {
  _id: string;
  name: string;
  email: string;
  timezone: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type PlatformCode = "TG" | "FB" | "YB" | "TK" | "IG" | "LN";
export type PlatformStatus = "connected" | "expired" | "revoked" | "error";

export interface SupportedPlatform {
  code: PlatformCode;
  name: string;
  description: string;
  is_supported: boolean;
  required_details: string[];
}

export interface Platform {
  _id: string;
  user_id: string;
  code: PlatformCode;
  account_name?: string;
  platform_account_id?: string;
  details: Record<string, any>;
  expires_at?: string;
  status: PlatformStatus;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export type ContentType = "text" | "image" | "audio" | "video";
export type ContentStatus = "draft" | "generating" | "ready" | "approved" | "archived";

export interface ContentDetail {
  type: ContentType;
  script?: string;
  path?: string;
  text?: string;
  order: number;
  mime_type?: string;
  file_size_bytes?: number;
  duration_seconds?: number;
  dimensions?: { width: number; height: number };
}

export interface Content {
  _id: string;
  user_id: string;
  title: string;
  details: ContentDetail[];
  status: ContentStatus;
  created_at: string;
  updated_at: string;
}

export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "partial" | "failed";
export type PostTargetStatus = "pending" | "publishing" | "published" | "failed" | "skipped";

export interface PostTarget {
  _id: string;
  post_id: string;
  user_id: string;
  platform_id: string;
  platform_code: PlatformCode;
  scheduled_at?: string;
  status: PostTargetStatus;
  attempts: number;
  error?: string;
  external_post_id?: string;
  external_url?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Post {
  _id: string;
  user_id: string;
  content_id: string;
  scheduled_at?: string;
  status: PostStatus;
  targets: PostTarget[];
  created_at: string;
  updated_at: string;
}

export interface Prompt {
  _id: string;
  parent_prompt_id?: string;
  user_id: string;
  content_id?: string;
  type: "content";
  prompt: string;
  response?: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  status: "pending" | "streaming" | "done" | "failed";
  error?: string;
  created_at: string;
  updated_at: string;
}

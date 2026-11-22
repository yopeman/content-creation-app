from datetime import datetime
import mimetypes
from pathlib import Path
from typing import Any, Dict, Optional
from fastapi import HTTPException, status
import httpx
from app.core.config import settings
from app.models.enums import ContentType


def _resolve_local_media_path(path_str: str) -> Optional[Path]:
    """Resolves local media file path from absolute or relative string."""
    p = Path(path_str)
    if p.is_file():
        return p

    # Handle uploads/ relative paths
    if path_str.startswith("uploads/"):
        rel = path_str[len("uploads/"):].lstrip("/")
        candidate = settings.upload_path / rel
        if candidate.is_file():
            return candidate

    candidate2 = settings.upload_path / path_str.lstrip("/")
    if candidate2.is_file():
        return candidate2

    return None


async def get_telegram_chat_info(bot_token: str, chat_id: str) -> Dict[str, Any]:
    """Calls Telegram Bot API getChat endpoint to validate bot credentials and fetch channel/chat metadata."""
    url = f"https://api.telegram.org/bot{bot_token}/getChat"
    params = {"chat_id": chat_id}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(url, params=params)
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Unable to reach Telegram API: {str(exc)}",
            )

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            result = data.get("result", {})
            title = (
                result.get("title")
                or result.get("username")
                or result.get("first_name")
                or str(chat_id)
            )
            return {
                "title": title,
                "type": result.get("type", "channel"),
                "username": result.get("username"),
                "raw": result,
            }

    # Handle API errors returned by Telegram
    try:
        err_json = response.json()
        description = err_json.get("description", "Unknown Telegram error")
    except Exception:
        description = response.text or "Unknown Telegram error"

    if response.status_code == 401:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Telegram Bot Token. Please check the token provided by @BotFather.",
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Telegram connection error: {description}",
    )


async def send_telegram_post(
    bot_token: str,
    chat_id: str,
    text: Optional[str] = None,
    media_path: Optional[str] = None,
    media_type: Optional[ContentType] = None,
    scheduled_at: Optional[datetime] = None,
    payload_override: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Publishes or schedules a post directly to Telegram via Bot API.

    Supports text messages, photos, videos, and audio.
    Delegates scheduling to the target social media platform using schedule_date.
    """
    override = payload_override or {}
    schedule_timestamp = int(scheduled_at.timestamp()) if scheduled_at else None

    # Base params
    base_data: Dict[str, Any] = {"chat_id": chat_id}
    if override.get("disable_notification") is not None:
        base_data["disable_notification"] = override["disable_notification"]
    if override.get("protect_content") is not None:
        base_data["protect_content"] = override["protect_content"]
    if override.get("parse_mode"):
        base_data["parse_mode"] = override["parse_mode"]
    if schedule_timestamp:
        base_data["schedule_date"] = schedule_timestamp

    local_file = _resolve_local_media_path(media_path) if media_path else None

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # 1. Image upload / sendPhoto
            if media_type == ContentType.IMAGE and (local_file or media_path):
                url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
                caption = (text or override.get("caption") or "")[:1024]
                data = {**base_data, "caption": caption}

                if local_file:
                    mime = mimetypes.guess_type(local_file.name)[0] or "image/png"
                    with open(local_file, "rb") as f:
                        files = {"photo": (local_file.name, f.read(), mime)}
                        response = await client.post(url, data=data, files=files)
                else:
                    data["photo"] = media_path
                    response = await client.post(url, data=data)

            # 2. Video upload / sendVideo
            elif media_type == ContentType.VIDEO and (local_file or media_path):
                url = f"https://api.telegram.org/bot{bot_token}/sendVideo"
                caption = (text or override.get("caption") or "")[:1024]
                data = {**base_data, "caption": caption}

                if local_file:
                    mime = mimetypes.guess_type(local_file.name)[0] or "video/mp4"
                    with open(local_file, "rb") as f:
                        files = {"video": (local_file.name, f.read(), mime)}
                        response = await client.post(url, data=data, files=files)
                else:
                    data["video"] = media_path
                    response = await client.post(url, data=data)

            # 3. Audio upload / sendAudio
            elif media_type == ContentType.AUDIO and (local_file or media_path):
                url = f"https://api.telegram.org/bot{bot_token}/sendAudio"
                caption = (text or override.get("caption") or "")[:1024]
                data = {**base_data, "caption": caption}

                if local_file:
                    mime = mimetypes.guess_type(local_file.name)[0] or "audio/mpeg"
                    with open(local_file, "rb") as f:
                        files = {"audio": (local_file.name, f.read(), mime)}
                        response = await client.post(url, data=data, files=files)
                else:
                    data["audio"] = media_path
                    response = await client.post(url, data=data)

            # 4. Text only / sendMessage
            else:
                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                data = {**base_data, "text": text or "Untitled Post"}
                response = await client.post(url, json=data)

        except httpx.RequestError as exc:
            return {
                "success": False,
                "error": f"Network error connecting to Telegram: {str(exc)}",
            }

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            result = data.get("result", {})
            message_id = result.get("message_id")
            chat_obj = result.get("chat", {})
            username = chat_obj.get("username")

            external_url = None
            if username and message_id:
                external_url = f"https://t.me/{username}/{message_id}"
            elif message_id:
                raw_chat_id = str(chat_obj.get("id", chat_id))
                if raw_chat_id.startswith("-100"):
                    external_url = f"https://t.me/c/{raw_chat_id[4:]}/{message_id}"

            return {
                "success": True,
                "message_id": str(message_id) if message_id else None,
                "external_url": external_url,
                "raw": result,
            }

    try:
        err_json = response.json()
        err_desc = err_json.get("description", "Unknown Telegram error")
    except Exception:
        err_desc = response.text or "Unknown Telegram error"

    return {
        "success": False,
        "error": f"Telegram API error ({response.status_code}): {err_desc}",
        "raw": response.text,
    }

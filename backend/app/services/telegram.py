from datetime import datetime
import mimetypes
from pathlib import Path
from typing import Any, Dict, List, Optional
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
    content_details: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """Publishes a post directly to Telegram via Bot API.

    Supports multimodal publishing: when content_details is provided, ALL attached
    text, images, audio narration, and video clips are sequentially published to the channel.
    """
    override = payload_override or {}

    # Base params
    base_data: Dict[str, Any] = {"chat_id": chat_id}
    if override.get("disable_notification") is not None:
        base_data["disable_notification"] = override["disable_notification"]
    if override.get("protect_content") is not None:
        base_data["protect_content"] = override["protect_content"]
    if override.get("parse_mode"):
        base_data["parse_mode"] = override["parse_mode"]

    async with httpx.AsyncClient(timeout=60.0) as client:
        # Helper to execute a single Telegram call
        async def _call_tg(endpoint: str, data: dict, files: dict = None, as_json: bool = False):
            url = f"https://api.telegram.org/bot{bot_token}/{endpoint}"
            try:
                if files:
                    return await client.post(url, data=data, files=files)
                elif as_json:
                    return await client.post(url, json=data)
                else:
                    return await client.post(url, data=data)
            except httpx.RequestError as exc:
                return exc

        # -------------------------------------------------------------
        # BRANCH A: MULTI-ITEM DISPATCH (content_details provided)
        # -------------------------------------------------------------
        if content_details is not None and len(content_details) > 0:
            sorted_details = sorted(content_details, key=lambda d: getattr(d, "order", 0))

            text_items = [d for d in sorted_details if getattr(d, "type", None) == ContentType.TEXT]
            image_items = [d for d in sorted_details if getattr(d, "type", None) == ContentType.IMAGE and getattr(d, "path", None)]
            video_items = [d for d in sorted_details if getattr(d, "type", None) == ContentType.VIDEO and getattr(d, "path", None)]
            audio_items = [d for d in sorted_details if getattr(d, "type", None) == ContentType.AUDIO and getattr(d, "path", None)]

            # Combine text copy
            combined_text = text or override.get("text") or override.get("caption")
            if not combined_text:
                texts = [getattr(d, "text", "") for d in text_items if getattr(d, "text", "")]
                combined_text = "\n\n".join(texts) if texts else "New Content Update"

            sent_message_ids: List[str] = []
            external_url: Optional[str] = None
            last_error: Optional[str] = None

            def _parse_resp(resp):
                nonlocal external_url, last_error
                if isinstance(resp, Exception):
                    last_error = f"Network error: {str(resp)}"
                    return None
                if resp.status_code == 200:
                    body = resp.json()
                    if body.get("ok"):
                        res_obj = body.get("result", {})
                        m_id = str(res_obj.get("message_id"))
                        sent_message_ids.append(m_id)
                        if not external_url:
                            chat_obj = res_obj.get("chat", {})
                            username = chat_obj.get("username")
                            if username:
                                external_url = f"https://t.me/{username}/{m_id}"
                            else:
                                raw_cid = str(chat_obj.get("id", chat_id))
                                if raw_cid.startswith("-100"):
                                    external_url = f"https://t.me/c/{raw_cid[4:]}/{m_id}"
                        return m_id
                try:
                    err_desc = resp.json().get("description", resp.text)
                except Exception:
                    err_desc = resp.text
                last_error = f"Telegram error ({resp.status_code}): {err_desc}"
                return None

            # 1. Post visual items (images & videos)
            visual_items = []
            for img in image_items:
                visual_items.append((ContentType.IMAGE, img))
            for vid in video_items:
                visual_items.append((ContentType.VIDEO, vid))

            caption_used = False
            for idx, (v_type, item) in enumerate(visual_items):
                p_file = _resolve_local_media_path(item.path)
                caption = ""
                if not caption_used:
                    caption = combined_text[:1024]
                    caption_used = True
                else:
                    caption = (getattr(item, "text", "") or getattr(item, "script", "") or "")[:1024]

                if v_type == ContentType.IMAGE:
                    data = {**base_data, "caption": caption}
                    if p_file:
                        mime = mimetypes.guess_type(p_file.name)[0] or "image/png"
                        with open(p_file, "rb") as f:
                            r = await _call_tg("sendPhoto", data=data, files={"photo": (p_file.name, f.read(), mime)})
                    else:
                        data["photo"] = item.path
                        r = await _call_tg("sendPhoto", data=data)
                    _parse_resp(r)

                elif v_type == ContentType.VIDEO:
                    data = {**base_data, "caption": caption}
                    if p_file:
                        mime = mimetypes.guess_type(p_file.name)[0] or "video/mp4"
                        with open(p_file, "rb") as f:
                            r = await _call_tg("sendVideo", data=data, files={"video": (p_file.name, f.read(), mime)})
                    else:
                        data["video"] = item.path
                        r = await _call_tg("sendVideo", data=data)
                    _parse_resp(r)

            # 2. If no visual media was posted, send text post
            if not caption_used and combined_text:
                r = await _call_tg("sendMessage", data={**base_data, "text": combined_text}, as_json=True)
                _parse_resp(r)

            # 3. Post audio narration items
            for a_item in audio_items:
                p_file = _resolve_local_media_path(a_item.path)
                a_caption = (getattr(a_item, "script", "") or getattr(a_item, "text", "") or "")[:1024]
                data = {**base_data, "caption": a_caption}
                if p_file:
                    mime = mimetypes.guess_type(p_file.name)[0] or "audio/mpeg"
                    with open(p_file, "rb") as f:
                        r = await _call_tg("sendAudio", data=data, files={"audio": (p_file.name, f.read(), mime)})
                else:
                    data["audio"] = a_item.path
                    r = await _call_tg("sendAudio", data=data)
                _parse_resp(r)

            if sent_message_ids:
                return {
                    "success": True,
                    "message_id": sent_message_ids[0],
                    "message_ids": sent_message_ids,
                    "external_url": external_url,
                }
            return {
                "success": False,
                "error": last_error or "Failed to send content items to Telegram.",
            }

        # -------------------------------------------------------------
        # BRANCH B: SINGLE-ITEM FALLBACK (for backward compatibility)
        # -------------------------------------------------------------
        try:
            local_file = _resolve_local_media_path(media_path) if media_path else None
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

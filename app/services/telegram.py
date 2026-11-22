from typing import Any, Dict
from fastapi import HTTPException, status
import httpx


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

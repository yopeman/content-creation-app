import base64
from datetime import datetime, timedelta, timezone
import hashlib
from typing import Any, Optional
import bcrypt
from cryptography.fernet import Fernet
import jwt
from app.core.config import settings


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(subject: str | Any, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_claim_token(user_id: str, content_id: str, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode = {
        "exp": expire,
        "sub": str(user_id),
        "content_id": str(content_id),
        "type": "claim_ticket",
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_claim_token(token: str) -> dict:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("type") != "claim_ticket":
        raise ValueError("Invalid claim ticket type")
    return payload


def _get_fernet() -> Fernet:
    """Derives a Fernet key deterministically from ENCRYPTION_KEY (fallback to SECRET_KEY for backwards-compatibility)."""
    key_source = settings.ENCRYPTION_KEY or settings.SECRET_KEY
    derived_key = base64.urlsafe_b64encode(hashlib.sha256(key_source.encode("utf-8")).digest())
    return Fernet(derived_key)


def encrypt_secret(plain_text: str) -> str:
    """Encrypts a sensitive plaintext secret (e.g. Telegram bot token) using authenticated Fernet (AES-128-CBC + HMAC)."""
    if not plain_text:
        return plain_text
    fernet = _get_fernet()
    return fernet.encrypt(plain_text.encode("utf-8")).decode("utf-8")


def decrypt_secret(cipher_text: str) -> str:
    """Decrypts an encrypted ciphertext secret back into plaintext."""
    if not cipher_text:
        return cipher_text
    fernet = _get_fernet()
    return fernet.decrypt(cipher_text.encode("utf-8")).decode("utf-8")

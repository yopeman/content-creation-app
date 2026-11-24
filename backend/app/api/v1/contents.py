import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from app.api.deps import get_current_user
from app.models.content import Content, ContentDetail
from app.models.enums import ContentType
from app.models.user import User
from app.schemas.content import (
    ContentCreate,
    ContentResponse,
    ContentUpdate,
)
from app.services.storage import storage_service

router = APIRouter()

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico", ".tiff"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".flv", ".wmv"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".wma"}

# Maximum allowed file sizes per media type
MAX_MEDIA_SIZES = {
    ContentType.IMAGE: 20 * 1024 * 1024,   # 20 MB
    ContentType.AUDIO: 50 * 1024 * 1024,   # 50 MB
    ContentType.VIDEO: 200 * 1024 * 1024,  # 200 MB
}


def validate_magic_bytes(header: bytes, media_type: ContentType) -> bool:
    """Validates binary signatures (magic bytes) to prevent file-type spoofing."""
    if not header:
        return False

    if media_type == ContentType.IMAGE:
        # PNG
        if header.startswith(b"\x89PNG\r\n\x1a\n"):
            return True
        # JPEG
        if header.startswith(b"\xff\xd8\xff"):
            return True
        # GIF
        if header.startswith(b"GIF87a") or header.startswith(b"GIF89a"):
            return True
        # WEBP
        if header.startswith(b"RIFF") and len(header) >= 12 and header[8:12] == b"WEBP":
            return True
        # BMP
        if header.startswith(b"BM"):
            return True
        # SVG
        lower_head = header[:512].lower()
        if b"<svg" in lower_head or (b"<?xml" in lower_head and b"<svg" in lower_head):
            return True
        # TIFF
        if header.startswith(b"II*\x00") or header.startswith(b"MM\x00*"):
            return True
        # ICO
        if header.startswith(b"\x00\x00\x01\x00"):
            return True
        return False

    elif media_type == ContentType.VIDEO:
        # MP4 / MOV (ftyp box in first 32 bytes or moov box in first 64 bytes)
        if len(header) >= 8 and (b"ftyp" in header[:32] or b"moov" in header[:64]):
            return True
        # WebM / MKV (EBML signature)
        if header.startswith(b"\x1a\x45\xdf\xa3"):
            return True
        # AVI
        if header.startswith(b"RIFF") and len(header) >= 12 and header[8:12] == b"AVI ":
            return True
        # FLV
        if header.startswith(b"FLV\x01"):
            return True
        # WMV / ASF
        if header.startswith(b"\x30\x26\xb2\x75\x8e\x66\xcf\x11"):
            return True
        return False

    elif media_type == ContentType.AUDIO:
        # MP3 (ID3v2 header or MPEG sync frame)
        if header.startswith(b"ID3"):
            return True
        if len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xE0) == 0xE0:
            return True
        # WAV
        if header.startswith(b"RIFF") and len(header) >= 12 and header[8:12] == b"WAVE":
            return True
        # OGG
        if header.startswith(b"OggS"):
            return True
        # FLAC
        if header.startswith(b"fLaC"):
            return True
        # AAC (ADTS)
        if len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xF6) == 0xF0:
            return True
        # M4A / AAC in MP4 container
        if len(header) >= 8 and b"ftyp" in header[:32]:
            return True
        return False

    return False


def detect_media_type(file: UploadFile) -> ContentType:
    """Detects media ContentType (image, audio, video) from UploadFile MIME type and extension."""
    content_type = (file.content_type or "").lower()
    filename = (file.filename or "").lower()

    if content_type.startswith("image/"):
        return ContentType.IMAGE
    if content_type.startswith("video/"):
        return ContentType.VIDEO
    if content_type.startswith("audio/"):
        return ContentType.AUDIO

    # Guess MIME type by filename
    guessed_type, _ = mimetypes.guess_type(filename)
    if guessed_type:
        if guessed_type.startswith("image/"):
            return ContentType.IMAGE
        if guessed_type.startswith("video/"):
            return ContentType.VIDEO
        if guessed_type.startswith("audio/"):
            return ContentType.AUDIO

    # Fallback to extension check
    ext = Path(filename).suffix.lower()
    if ext in IMAGE_EXTENSIONS:
        return ContentType.IMAGE
    if ext in VIDEO_EXTENSIONS:
        return ContentType.VIDEO
    if ext in AUDIO_EXTENSIONS:
        return ContentType.AUDIO

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unable to identify media type for file '{file.filename}'. Supported formats: image, audio, video.",
    )


@router.post("/upload-media", summary="Upload media file to local storage")
async def upload_media(
    file: UploadFile = File(...),
    media_type: Optional[ContentType] = Form(None),
    current_user: User = Depends(get_current_user),
):
    """Uploads a local media file (image, audio, video) and returns its storage path and web URL.

    Automatically detects the media type, enforces file size limits, and validates magic bytes.
    """
    resolved_type = media_type or detect_media_type(file)
    max_size = MAX_MEDIA_SIZES.get(resolved_type, 100 * 1024 * 1024)

    # 1. Check size if pre-reported by client
    if file.size and file.size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {max_size // (1024 * 1024)}MB.",
        )

    # 2. Validate magic bytes from initial file header
    header = await file.read(2048)
    await file.seek(0)

    if not validate_magic_bytes(header, resolved_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File content does not match expected {resolved_type.value} binary signature (magic bytes).",
        )

    # 3. Stream and persist to local storage with size enforcement
    result = await storage_service.save_file(
        file,
        subfolder=resolved_type.value,
        max_size_bytes=max_size,
    )
    return {
        "status": "success",
        "detail": {
            "type": resolved_type,
            "path": result["path"],
            "url": result["url"],
            "mime_type": result["mime_type"],
            "file_size_bytes": result["file_size_bytes"],
            "original_filename": result["original_filename"],
        },
    }


@router.post("", response_model=ContentResponse, status_code=status.HTTP_201_CREATED, summary="Create Manual Content")
async def create_content(payload: ContentCreate, current_user: User = Depends(get_current_user)):
    """Manually creates a new content entry for the authenticated user."""
    details = [ContentDetail(**d.model_dump()) for d in payload.details]

    content = Content(
        user_id=current_user.id,
        title=payload.title,
        details=details,
        status=payload.status,
    )
    await content.insert()
    return content


@router.get("", response_model=List[ContentResponse], summary="List User Contents")
async def list_contents(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of items to return"),
    current_user: User = Depends(get_current_user),
):
    """Retrieves all non-deleted contents owned by the current user."""
    return await Content.find(
        Content.user_id == current_user.id,
        Content.deleted_at == None,  # noqa: E711
    ).skip(skip).limit(limit).to_list()


@router.get("/{content_id}", response_model=ContentResponse, summary="Get Content by ID")
async def get_content(content_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    """Retrieves a single content item owned by the authenticated user."""
    content = await Content.find_one(
        Content.id == content_id,
        Content.user_id == current_user.id,
        Content.deleted_at == None,  # noqa: E711
    )
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    return content


@router.put("/{content_id}", response_model=ContentResponse, summary="Update Content")
async def update_content(
    content_id: PydanticObjectId,
    payload: ContentUpdate,
    current_user: User = Depends(get_current_user),
):
    """Updates content title, status, or details for an owned content document."""
    content = await Content.find_one(
        Content.id == content_id,
        Content.user_id == current_user.id,
        Content.deleted_at == None,  # noqa: E711
    )
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")

    if payload.title is not None:
        content.title = payload.title
    if payload.status is not None:
        content.status = payload.status
    if payload.details is not None:
        content.details = [ContentDetail(**d.model_dump()) for d in payload.details]

    content.updated_at = datetime.now(timezone.utc)
    await content.save()
    return content


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Content")
async def delete_content(content_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    """Soft-deletes content owned by the authenticated user."""
    content = await Content.find_one(
        Content.id == content_id,
        Content.user_id == current_user.id,
        Content.deleted_at == None,  # noqa: E711
    )
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")

    content.deleted_at = datetime.now(timezone.utc)
    await content.save()

import os
import uuid
from pathlib import Path
from typing import Dict, Optional
import aiofiles
from fastapi import HTTPException, UploadFile, status
from app.core.config import settings


class LocalStorageService:
    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or settings.upload_path

    async def save_file(
        self,
        upload_file: UploadFile,
        subfolder: str = "",
        max_size_bytes: Optional[int] = None,
    ) -> Dict[str, str | int]:
        target_dir = self.base_path / subfolder if subfolder else self.base_path
        target_dir.mkdir(parents=True, exist_ok=True)

        original_ext = Path(upload_file.filename or "").suffix.lower()
        unique_name = f"{uuid.uuid4().hex}{original_ext}"
        destination_path = target_dir / unique_name

        file_size = 0
        try:
            async with aiofiles.open(destination_path, "wb") as out_file:
                while chunk := await upload_file.read(1024 * 64):  # 64KB chunks
                    file_size += len(chunk)
                    if max_size_bytes and file_size > max_size_bytes:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"File size exceeds limit of {max_size_bytes // (1024 * 1024)}MB.",
                        )
                    await out_file.write(chunk)
        except Exception:
            if destination_path.exists():
                destination_path.unlink()
            raise

        # Relative path for storage and web access URL
        rel_path = f"{subfolder}/{unique_name}".strip("/")
        web_url = f"/uploads/{rel_path}"

        return {
            "filename": unique_name,
            "original_filename": upload_file.filename or unique_name,
            "path": str(destination_path),
            "url": web_url,
            "file_size_bytes": file_size,
            "mime_type": upload_file.content_type or "application/octet-stream",
        }

    def delete_file(self, file_path: str) -> bool:
        path = Path(file_path)
        if path.exists() and path.is_file():
            os.remove(path)
            return True
        return False


storage_service = LocalStorageService()

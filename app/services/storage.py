import os
import uuid
from pathlib import Path
from typing import Dict, Optional
import aiofiles
from fastapi import UploadFile
from app.core.config import settings


class LocalStorageService:
    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or settings.upload_path

    async def save_file(self, upload_file: UploadFile, subfolder: str = "") -> Dict[str, str | int]:
        target_dir = self.base_path / subfolder if subfolder else self.base_path
        target_dir.mkdir(parents=True, exist_ok=True)

        original_ext = Path(upload_file.filename or "").suffix.lower()
        unique_name = f"{uuid.uuid4().hex}{original_ext}"
        destination_path = target_dir / unique_name

        file_size = 0
        async with aiofiles.open(destination_path, "wb") as out_file:
            while chunk := await upload_file.read(1024 * 64):  # 64KB chunks
                file_size += len(chunk)
                await out_file.write(chunk)

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

import os
from pathlib import Path
import subprocess
from typing import Optional
from uuid import uuid4
from PIL import Image, ImageDraw, ImageFont
from gtts import gTTS
from app.core.config import settings


def _ensure_upload_dirs():
    (settings.upload_path / "image").mkdir(parents=True, exist_ok=True)
    (settings.upload_path / "audio").mkdir(parents=True, exist_ok=True)
    (settings.upload_path / "video").mkdir(parents=True, exist_ok=True)


def create_text_content(prompt: str) -> str:
    """Returns generated post text based on prompt."""
    return prompt.strip()


def create_image_content(prompt: str, filename_prefix: str = "img") -> dict:
    """Generates an image using Pillow with styled background and text overlay.

    Returns dict with local path, relative url, dimensions, and file size.
    """
    _ensure_upload_dirs()
    width, height = 1080, 1080
    filename = f"{filename_prefix}_{uuid4().hex[:10]}.png"
    rel_path = f"uploads/image/{filename}"
    abs_path = settings.upload_path / "image" / filename

    # Create modern dark gradient/solid background
    img = Image.new("RGB", (width, height), color=(26, 32, 44))
    draw = ImageDraw.Draw(img)

    # Accent top border
    draw.rectangle([(0, 0), (width, 16)], fill=(99, 102, 241))

    # Add wrapped text
    try:
        font = ImageFont.load_default(size=42)
    except Exception:
        font = ImageFont.load_default()

    # Simple word wrap
    words = prompt.split()
    lines = []
    current_line = []
    for word in words:
        test_line = " ".join(current_line + [word])
        if len(test_line) > 36:
            lines.append(" ".join(current_line))
            current_line = [word]
        else:
            current_line.append(word)
    if current_line:
        lines.append(" ".join(current_line))

    display_text = "\n".join(lines[:12])
    draw.multiline_text(
        (width // 2, height // 2),
        display_text,
        fill=(248, 250, 252),
        font=font,
        anchor="mm",
        align="center",
        spacing=16,
    )

    img.save(abs_path, format="PNG")
    file_size = os.path.getsize(abs_path)

    return {
        "path": rel_path,
        "abs_path": str(abs_path),
        "url": f"/uploads/image/{filename}",
        "mime_type": "image/png",
        "file_size_bytes": file_size,
        "dimensions": {"width": width, "height": height},
    }


def create_audio_content(text_to_speak: str, filename_prefix: str = "audio") -> dict:
    """Generates an MP3 audio file from text using gTTS.

    Returns dict with local path, relative url, and file size.
    """
    _ensure_upload_dirs()
    filename = f"{filename_prefix}_{uuid4().hex[:10]}.mp3"
    rel_path = f"uploads/audio/{filename}"
    abs_path = settings.upload_path / "audio" / filename

    clean_text = text_to_speak.strip() or "Content Creation Audio Announcement"
    tts = gTTS(text=clean_text, lang="en")
    tts.save(str(abs_path))
    file_size = os.path.getsize(abs_path)

    return {
        "path": rel_path,
        "abs_path": str(abs_path),
        "url": f"/uploads/audio/{filename}",
        "mime_type": "audio/mpeg",
        "file_size_bytes": file_size,
    }


def create_video_content(
    prompt: str,
    visual_text: Optional[str] = None,
    voiceover_text: Optional[str] = None,
    filename_prefix: str = "video",
) -> dict:
    """Combines a Pillow image and gTTS audio into an MP4 video using MoviePy or ffmpeg."""
    _ensure_upload_dirs()
    filename = f"{filename_prefix}_{uuid4().hex[:10]}.mp4"
    rel_path = f"uploads/video/{filename}"
    abs_path = settings.upload_path / "video" / filename

    # 1. Generate image asset
    image_text = visual_text or prompt
    img_data = create_image_content(image_text, filename_prefix="vid_frame")

    # 2. Generate voiceover audio asset
    voice_text = voiceover_text or prompt
    audio_data = create_audio_content(voice_text, filename_prefix="vid_audio")

    # 3. Combine into MP4 using ffmpeg directly (robust and fast) or moviepy
    cmd = [
        "ffmpeg",
        "-y",
        "-loop", "1",
        "-i", img_data["abs_path"],
        "-i", audio_data["abs_path"],
        "-c:v", "libx264",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        str(abs_path),
    ]

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        # Fallback to MoviePy
        try:
            from moviepy.editor import AudioFileClip, ImageClip  # v1 compatibility
        except ImportError:
            from moviepy import AudioFileClip, ImageClip  # v2 compatibility

        audio_clip = AudioFileClip(audio_data["abs_path"])
        duration = getattr(audio_clip, "duration", 5.0)
        if hasattr(ImageClip, "with_duration"):
            image_clip = ImageClip(img_data["abs_path"]).with_duration(duration)
            video_clip = image_clip.with_audio(audio_clip)
        else:
            image_clip = ImageClip(img_data["abs_path"]).set_duration(duration)
            video_clip = image_clip.set_audio(audio_clip)

        video_clip.write_videofile(
            str(abs_path),
            fps=24,
            codec="libx264",
            audio_codec="aac",
            logger=None,
        )

    file_size = os.path.getsize(abs_path) if abs_path.exists() else 0

    return {
        "path": rel_path,
        "abs_path": str(abs_path),
        "url": f"/uploads/video/{filename}",
        "mime_type": "video/mp4",
        "file_size_bytes": file_size,
    }

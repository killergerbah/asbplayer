import os
import tempfile
import subprocess
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import static_ffmpeg

# Download and add static ffmpeg to PATH
static_ffmpeg.add_paths()

app = FastAPI(title="YouTube Transcript Server")

# CORS for browser extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API key for protecting this endpoint (optional)
API_KEY = os.environ.get("TRANSCRIPT_API_KEY", "")

# OpenAI API key for Whisper
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")


class TranscriptRequest(BaseModel):
    url: str
    language: str | None = None


class TranscriptResponse(BaseModel):
    srt: str


def format_srt_time(seconds: float) -> str:
    """Convert seconds to SRT time format HH:MM:SS,mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def segments_to_srt(segments: list) -> str:
    """Convert Whisper segments to SRT format"""
    srt_lines = []
    for i, segment in enumerate(segments, 1):
        start = format_srt_time(segment["start"])
        end = format_srt_time(segment["end"])
        text = segment["text"].strip()
        srt_lines.append(f"{i}\n{start} --> {end}\n{text}\n")
    return "\n".join(srt_lines)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/transcript", response_model=TranscriptResponse)
async def get_transcript(
    request: TranscriptRequest,
    x_api_key: str | None = Header(None),
):
    # Check API key if configured
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    # Validate URL
    if "youtube.com" not in request.url and "youtu.be" not in request.url:
        raise HTTPException(status_code=400, detail="Only YouTube URLs are supported")

    try:
        # Create temp directory for audio file
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_path = os.path.join(tmpdir, "audio.m4a")

            # Download audio using yt-dlp
            cmd = [
                "yt-dlp",
                "-x",  # Extract audio
                "--audio-format", "m4a",
                "--audio-quality", "0",  # Best quality
                "-o", audio_path,
                "--no-playlist",  # Single video only
                "--max-filesize", "100M",  # Limit file size
                request.url,
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,  # 2 minute timeout for download
            )

            if result.returncode != 0:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to download audio: {result.stderr[:500]}"
                )

            # Check if file exists (yt-dlp might add extension)
            if not os.path.exists(audio_path):
                # Try with .m4a.m4a (yt-dlp sometimes doubles extension)
                for f in os.listdir(tmpdir):
                    if f.startswith("audio"):
                        audio_path = os.path.join(tmpdir, f)
                        break

            if not os.path.exists(audio_path):
                raise HTTPException(
                    status_code=500,
                    detail="Audio file not found after download"
                )

            # Transcribe using OpenAI Whisper API
            client = openai.OpenAI(api_key=OPENAI_API_KEY)

            with open(audio_path, "rb") as audio_file:
                transcription = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json",
                    language=request.language,
                )

            # Convert to SRT
            if hasattr(transcription, "segments") and transcription.segments:
                srt_content = segments_to_srt(transcription.segments)
            else:
                # Fallback if no segments (shouldn't happen with verbose_json)
                srt_content = f"1\n00:00:00,000 --> 00:10:00,000\n{transcription.text}\n"

            return TranscriptResponse(srt=srt_content)

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail="Download timed out. Video may be too long."
        )
    except openai.APIError as e:
        raise HTTPException(
            status_code=500,
            detail=f"OpenAI API error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))

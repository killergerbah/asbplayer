import os
import tempfile
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
from pytubefix import YouTube

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
        # Handle both dict and object access
        if hasattr(segment, 'start'):
            start = format_srt_time(segment.start)
            end = format_srt_time(segment.end)
            text = segment.text.strip()
        else:
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
            # Download audio using pytubefix
            try:
                yt = YouTube(request.url)

                # Try to get m4a stream first (best compatibility with Whisper)
                audio_stream = yt.streams.filter(only_audio=True, mime_type="audio/mp4").order_by('abr').desc().first()

                # Fallback to webm if no m4a
                if not audio_stream:
                    audio_stream = yt.streams.filter(only_audio=True, mime_type="audio/webm").order_by('abr').desc().first()

                # Last resort: any audio stream
                if not audio_stream:
                    audio_stream = yt.streams.filter(only_audio=True).order_by('abr').desc().first()

                if not audio_stream:
                    raise HTTPException(
                        status_code=500,
                        detail="No audio stream found for this video"
                    )

                # Determine file extension from mime type
                if "mp4" in audio_stream.mime_type:
                    ext = "m4a"
                elif "webm" in audio_stream.mime_type:
                    ext = "webm"
                else:
                    ext = "mp4"  # Default

                # Download the audio with proper extension
                audio_path = audio_stream.download(output_path=tmpdir, filename=f"audio.{ext}")

            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to download audio: {str(e)}"
                )

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

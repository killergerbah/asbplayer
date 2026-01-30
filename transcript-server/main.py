import os
import tempfile
import glob
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import yt_dlp
from pydub import AudioSegment
import static_ffmpeg

# Download and add static ffmpeg to PATH (required by pydub and yt-dlp)
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

# Max file size for OpenAI Whisper API (25MB, use 24MB to be safe)
MAX_CHUNK_SIZE_MB = 24
# Chunk duration in milliseconds (20 minutes chunks to stay under size limit)
CHUNK_DURATION_MS = 20 * 60 * 1000


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


def segments_to_list(segments: list, time_offset: float = 0) -> list:
    """Convert Whisper segments to a list of dicts with time offset applied"""
    result = []
    for segment in segments:
        if hasattr(segment, 'start'):
            result.append({
                "start": segment.start + time_offset,
                "end": segment.end + time_offset,
                "text": segment.text.strip()
            })
        else:
            result.append({
                "start": segment["start"] + time_offset,
                "end": segment["end"] + time_offset,
                "text": segment["text"].strip()
            })
    return result


def segments_to_srt(segments: list) -> str:
    """Convert segments to SRT format"""
    srt_lines = []
    for i, segment in enumerate(segments, 1):
        start = format_srt_time(segment["start"])
        end = format_srt_time(segment["end"])
        text = segment["text"]
        srt_lines.append(f"{i}\n{start} --> {end}\n{text}\n")
    return "\n".join(srt_lines)


def split_audio(audio_path: str, tmpdir: str) -> list[tuple[str, float]]:
    """Split audio file into chunks, returns list of (chunk_path, start_time_seconds)"""
    audio = AudioSegment.from_file(audio_path)
    duration_ms = len(audio)

    # If audio is short enough, no need to split
    if duration_ms <= CHUNK_DURATION_MS:
        return [(audio_path, 0.0)]

    chunks = []
    start_ms = 0
    chunk_num = 0

    while start_ms < duration_ms:
        end_ms = min(start_ms + CHUNK_DURATION_MS, duration_ms)
        chunk = audio[start_ms:end_ms]

        chunk_path = os.path.join(tmpdir, f"chunk_{chunk_num}.mp3")
        chunk.export(chunk_path, format="mp3", bitrate="128k")

        chunks.append((chunk_path, start_ms / 1000.0))  # Convert to seconds

        start_ms = end_ms
        chunk_num += 1

    return chunks


def transcribe_audio(client: openai.OpenAI, audio_path: str, language: str | None) -> list:
    """Transcribe a single audio file and return segments"""
    with open(audio_path, "rb") as audio_file:
        transcription = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
            language=language,
        )

    if hasattr(transcription, "segments") and transcription.segments:
        return transcription.segments
    else:
        # Fallback if no segments
        return [{"start": 0, "end": 10, "text": transcription.text}]


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
            # Download audio using yt-dlp
            try:
                audio_path = os.path.join(tmpdir, "audio.m4a")
                ydl_opts = {
                    'format': 'bestaudio[ext=m4a]/bestaudio/best',
                    'outtmpl': os.path.join(tmpdir, 'audio.%(ext)s'),
                    'quiet': True,
                    'no_warnings': True,
                    'extract_flat': False,
                }

                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([request.url])

                # Find the downloaded file (extension may vary)
                downloaded_files = glob.glob(os.path.join(tmpdir, "audio.*"))
                if not downloaded_files:
                    raise HTTPException(
                        status_code=500,
                        detail="No audio file found after download"
                    )
                audio_path = downloaded_files[0]

            except yt_dlp.utils.DownloadError as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to download audio: {str(e)}"
                )
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

            # Split audio into chunks if needed
            chunks = split_audio(audio_path, tmpdir)

            # Transcribe each chunk
            client = openai.OpenAI(api_key=OPENAI_API_KEY)
            all_segments = []

            for chunk_path, time_offset in chunks:
                segments = transcribe_audio(client, chunk_path, request.language)
                all_segments.extend(segments_to_list(segments, time_offset))

            # Convert to SRT
            srt_content = segments_to_srt(all_segments)

            return TranscriptResponse(srt=srt_content)

    except openai.APIError as e:
        raise HTTPException(
            status_code=500,
            detail=f"OpenAI API error: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))

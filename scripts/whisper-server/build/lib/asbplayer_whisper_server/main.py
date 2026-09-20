from __future__ import annotations

import argparse
import asyncio
from collections import deque
import hashlib
import hmac
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, Field


DEFAULT_CACHE_ROOT = Path(os.environ.get("ASBPLAYER_WHISPER_CACHE_DIR", Path.home() / ".cache/asbplayer/whisper"))
AUTH_TOKEN_ENVIRONMENT_VARIABLE = "ASBPLAYER_WHISPER_AUTH_TOKEN"
DEFAULT_DEVICE = os.environ.get("ASBPLAYER_WHISPER_DEVICE", "cpu")
OCR_PIPELINE_VERSION = "pp-ocrv6-subtitle-v1"
OCR_SAMPLE_RATE = 4.0
OCR_CONFIDENCE_THRESHOLD = 0.60
OCR_DEFAULT_CROP = {"left": 0.0, "top": 0.65, "width": 1.0, "height": 0.35}
OCR_QUALITIES = {"medium": "PP-OCRv6_medium", "small": "PP-OCRv6_small"}
OCR_LANGUAGES = {"ch", "chinese_cht"}
logger = logging.getLogger("uvicorn.error")
WHISPER_TQDM_PROGRESS = re.compile(
    r"\d{1,3}%\|.*?\|\s*(?P<current>[\d,]+)/(?P<total>[\d,]+)"
)
WHISPER_TQDM_MODEL_DOWNLOAD = re.compile(
    r"(?P<percent>\d{1,3})%\|.*?\|\s*"
    r"(?P<current>\d+(?:\.\d+)?)(?P<current_unit>(?:[KMGTPE]?i?B|[KMGTPE])?)/"
    r"(?P<total>\d+(?:\.\d+)?)(?P<total_unit>(?:[KMGTPE]?i?B|[KMGTPE])?)\s+\["
)
WHISPER_TQDM_REMAINING = re.compile(r"<(?P<remaining>\d+:\d{2}(?::\d{2})?)")


@dataclass(frozen=True)
class OptionSpec:
    name: str
    label: str
    group: str
    kind: Literal["string", "number", "boolean"]
    default: str | float | int | bool | None
    affects_output: bool
    description: str | None = None
    choices: tuple[str | int | float, ...] | None = None

    def public(self) -> dict[str, Any]:
        result = {
            "name": self.name,
            "label": self.label,
            "group": self.group,
            "type": self.kind,
            "defaultValue": self.default,
            "affectsOutput": self.affects_output,
        }
        if self.description:
            result["description"] = self.description
        if self.choices:
            result["choices"] = list(self.choices)
        return result


# This mirrors the public flags in the pinned openai-whisper CLI. The source
# audio, output directory/format, and verbose mode are intentionally
# service-owned. Verbose mode is always disabled so Whisper emits its native
# frame counter and remaining-time estimate through tqdm.
OPTION_SPECS = (
    OptionSpec(
        "model",
        "Model",
        "Model",
        "string",
        "small",
        True,
        choices=(
            "tiny.en",
            "tiny",
            "base.en",
            "base",
            "small.en",
            "small",
            "medium.en",
            "medium",
            "large-v1",
            "large-v2",
            "large-v3",
            "large",
            "large-v3-turbo",
            "turbo",
        ),
    ),
    OptionSpec("model_dir", "Model directory", "Runtime", "string", None, False),
    OptionSpec("device", "Device", "Runtime", "string", DEFAULT_DEVICE, False),
    OptionSpec("task", "Task", "Transcription", "string", "transcribe", True, choices=("transcribe", "translate")),
    OptionSpec("language", "Source language", "Transcription", "string", None, True, "Leave blank for auto-detection."),
    OptionSpec("temperature", "Temperature", "Decoding", "number", 0, True),
    OptionSpec("best_of", "Best of", "Decoding", "number", 5, True),
    OptionSpec("beam_size", "Beam size", "Decoding", "number", 5, True),
    OptionSpec("patience", "Patience", "Decoding", "number", None, True),
    OptionSpec("length_penalty", "Length penalty", "Decoding", "number", None, True),
    OptionSpec("suppress_tokens", "Suppress tokens", "Decoding", "string", "-1", True),
    OptionSpec("initial_prompt", "Initial prompt", "Transcription", "string", None, True),
    OptionSpec("carry_initial_prompt", "Carry initial prompt", "Transcription", "boolean", False, True),
    OptionSpec("condition_on_previous_text", "Condition on previous text", "Transcription", "boolean", True, True),
    OptionSpec("fp16", "Use FP16", "Runtime", "boolean", True, False),
    OptionSpec("temperature_increment_on_fallback", "Fallback temperature increment", "Decoding", "number", 0.2, True),
    OptionSpec("compression_ratio_threshold", "Compression ratio threshold", "Decoding", "number", 2.4, True),
    OptionSpec("logprob_threshold", "Log probability threshold", "Decoding", "number", -1.0, True),
    OptionSpec("no_speech_threshold", "No-speech threshold", "Decoding", "number", 0.6, True),
    OptionSpec("word_timestamps", "Word timestamps", "Timestamps", "boolean", False, True),
    OptionSpec("prepend_punctuations", "Prepend punctuations", "Timestamps", "string", "\"'“¿([{-", True),
    OptionSpec("append_punctuations", "Append punctuations", "Timestamps", "string", "\"'.。,，!！?？:：”)]}、", True),
    OptionSpec("highlight_words", "Highlight words", "Timestamps", "boolean", False, True),
    OptionSpec("max_line_width", "Maximum line width", "Timestamps", "number", None, True),
    OptionSpec("max_line_count", "Maximum lines per subtitle", "Timestamps", "number", None, True),
    OptionSpec("max_words_per_line", "Maximum words per line", "Timestamps", "number", None, True),
    OptionSpec("threads", "CPU threads", "Runtime", "number", 0, False),
    OptionSpec("clip_timestamps", "Clip timestamps", "Timestamps", "string", "0", True),
    OptionSpec("hallucination_silence_threshold", "Hallucination silence threshold", "Decoding", "number", None, True),
)
SPECS_BY_NAME = {spec.name: spec for spec in OPTION_SPECS}


def configured_auth_token() -> str | None:
    token = os.environ.get(AUTH_TOKEN_ENVIRONMENT_VARIABLE, "").strip()
    return token or None


def request_is_authorized(authorization: str | None, expected_token: str | None) -> bool:
    if expected_token is None:
        return True
    if authorization is None:
        return False
    scheme, separator, token = authorization.partition(" ")
    return separator == " " and scheme.lower() == "bearer" and hmac.compare_digest(token, expected_token)


def require_authentication(authorization: str | None = Header(default=None)) -> None:
    if request_is_authorized(authorization, configured_auth_token()):
        return
    raise HTTPException(
        status_code=401,
        detail="A valid bearer token is required for this subtitle generation service.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def is_loopback_host(host: str) -> bool:
    return host.lower().strip("[]") in {"localhost", "127.0.0.1", "::1"}


class CreateJobRequest(BaseModel):
    sourceUrl: str = Field(min_length=1)
    generator: Literal["whisper", "ocr"] = "whisper"
    whisperOptions: dict[str, Any] = Field(default_factory=dict)
    ocrOptions: dict[str, Any] = Field(default_factory=dict)


@dataclass
class Job:
    id: str
    source_url: str
    source_identity: dict[str, str]
    source_key: str
    cache_id: str
    options: dict[str, Any]
    generator: Literal["whisper", "ocr"] = "whisper"
    ocr_options: dict[str, Any] | None = None
    state: str = "queued"
    progress: int | None = None
    error: str | None = None
    entry: dict[str, Any] | None = None
    last_reported_progress: int | None = None
    remaining_seconds: int | None = None
    completed_frames: int | None = None
    total_frames: int | None = None
    model_downloaded: str | None = None
    model_total: str | None = None
    cancel_requested: threading.Event = field(default_factory=threading.Event)
    process: subprocess.Popen[bytes] | None = None

    def public(self) -> dict[str, Any]:
        result: dict[str, Any] = {"id": self.id, "state": self.state}
        if self.generator != "whisper":
            result["generator"] = self.generator
        if self.progress is not None:
            result["progress"] = self.progress
        if self.remaining_seconds is not None:
            result["remainingSeconds"] = self.remaining_seconds
        if self.completed_frames is not None and self.total_frames is not None:
            result["completedFrames"] = self.completed_frames
            result["totalFrames"] = self.total_frames
        if self.model_downloaded is not None and self.model_total is not None:
            result["modelDownloaded"] = self.model_downloaded
            result["modelTotal"] = self.model_total
        if self.error:
            result["error"] = self.error
        if self.entry:
            result["entry"] = self.entry
        return result


def normalize_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("sourceUrl must be an HTTP(S) URL")
    query = urlencode(sorted(parse_qsl(parsed.query, keep_blank_values=True)))
    return urlunsplit((parsed.scheme, parsed.netloc.lower(), parsed.path, query, ""))


def validate_options(raw: dict[str, Any]) -> dict[str, Any]:
    unknown = sorted(set(raw) - set(SPECS_BY_NAME))
    if unknown:
        raise ValueError(f"Unsupported Whisper option: {unknown[0]}")

    normalized: dict[str, Any] = {}
    for spec in OPTION_SPECS:
        value = raw.get(spec.name, spec.default)
        # MUI represents an empty optional text field as an empty string. The
        # Whisper CLI requires --language to be omitted for language detection,
        # rather than receiving --language ''. Treat every optional text field
        # consistently so it is omitted when building the command below.
        if spec.kind == "string" and spec.default is None and isinstance(value, str) and not value.strip():
            normalized[spec.name] = None
            continue
        if value is None:
            normalized[spec.name] = None
            continue
        if spec.kind == "boolean":
            if not isinstance(value, bool):
                raise ValueError(f"{spec.name} must be true or false")
        elif spec.kind == "number":
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError(f"{spec.name} must be a number")
        elif not isinstance(value, str):
            raise ValueError(f"{spec.name} must be text")
        if spec.choices and value not in spec.choices:
            raise ValueError(f"{spec.name} must be one of: {', '.join(map(str, spec.choices))}")
        normalized[spec.name] = value
    return normalized


def validate_ocr_options(raw: dict[str, Any]) -> dict[str, Any]:
    unknown = sorted(set(raw) - {"crop", "language", "quality"})
    if unknown:
        raise ValueError(f"Unsupported OCR option: {unknown[0]}")

    language = raw.get("language", "ch")
    if language not in OCR_LANGUAGES:
        raise ValueError("OCR language must be Simplified or Traditional Chinese")
    quality = raw.get("quality", "medium")
    if quality not in OCR_QUALITIES:
        raise ValueError("OCR quality must be one of: medium, small")

    crop = raw.get("crop", OCR_DEFAULT_CROP)
    if not isinstance(crop, dict) or set(crop) != {"left", "top", "width", "height"}:
        raise ValueError("OCR crop must contain left, top, width, and height")
    normalized_crop: dict[str, float] = {}
    for name in ("left", "top", "width", "height"):
        value = crop[name]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 1:
            raise ValueError(f"OCR crop {name} must be a number between 0 and 1")
        normalized_crop[name] = float(value)
    if normalized_crop["width"] <= 0 or normalized_crop["height"] <= 0:
        raise ValueError("OCR crop width and height must be greater than zero")
    if normalized_crop["left"] + normalized_crop["width"] > 1 or normalized_crop["top"] + normalized_crop["height"] > 1:
        raise ValueError("OCR crop must fit inside the video")
    return {"crop": normalized_crop, "language": language, "quality": quality}


def source_key(identity: dict[str, str]) -> str:
    return hashlib.sha256(json.dumps(identity, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def cache_key(
    identity: dict[str, str],
    options: dict[str, Any],
    generator: Literal["whisper", "ocr"] = "whisper",
    ocr_options: dict[str, Any] | None = None,
) -> str:
    if generator == "whisper":
        # Preserve the cache identity of all existing Whisper entries.
        cache_options = {spec.name: options[spec.name] for spec in OPTION_SPECS if spec.affects_output}
        value = json.dumps({"source": identity, "options": cache_options}, sort_keys=True, separators=(",", ":"))
    else:
        value = json.dumps(
            {"source": identity, "generator": generator, "ocrOptions": ocr_options, "pipeline": OCR_PIPELINE_VERSION},
            sort_keys=True,
            separators=(",", ":"),
        )
    return hashlib.sha256(value.encode()).hexdigest()


def timestamp_seconds(value: str) -> float:
    seconds = 0.0
    for part in value.split(":"):
        seconds = seconds * 60 + float(part)
    return seconds


def whisper_tqdm_frame_counts(line: str) -> tuple[int, int] | None:
    match = WHISPER_TQDM_PROGRESS.search(line)
    if not match:
        return None
    current = int(match.group("current").replace(",", ""))
    total = int(match.group("total").replace(",", ""))
    if total <= 0:
        return None
    return current, total


def whisper_tqdm_model_download(line: str) -> tuple[int, str, str] | None:
    match = WHISPER_TQDM_MODEL_DOWNLOAD.search(line)
    if not match:
        return None
    if not match.group("current_unit") and not match.group("total_unit"):
        return None
    return (
        int(match.group("percent")),
        f"{match.group('current')}{match.group('current_unit')}",
        f"{match.group('total')}{match.group('total_unit')}",
    )


def whisper_tqdm_remaining_seconds(line: str) -> int | None:
    match = WHISPER_TQDM_REMAINING.search(line)
    if not match:
        return None
    return round(timestamp_seconds(match.group("remaining")))


def fallback_source_identity(normalized_url: str) -> dict[str, str]:
    return {"extractor": "url", "id": normalized_url, "url": normalized_url}


def source_identity_from_downloader_info(source_url: str, info: dict[str, Any]) -> dict[str, str]:
    """Build the stable cache identity after yt-dlp has resolved the source.

    Resolving this identity used to happen while handling POST /v1/jobs and
    GET /v1/cache. That made requests wait for a network-bound yt-dlp metadata
    request, which can exceed a tunnel proxy's request timeout. The worker
    already downloads the source, so reuse that result instead.
    """
    normalized_url = normalize_url(source_url)
    return {
        "extractor": str(info.get("extractor_key") or info.get("extractor") or "url"),
        "id": str(info.get("id") or normalized_url),
        "url": normalized_url,
    }


def output_options(options: dict[str, Any]) -> dict[str, Any]:
    return {spec.name: options[spec.name] for spec in OPTION_SPECS if spec.affects_output}


def ocr_capabilities() -> dict[str, Any]:
    try:
        import paddleocr  # noqa: F401
        import cv2  # noqa: F401
    except ImportError:
        return {
            "available": False,
            "error": "OCR support is not installed. Reinstall with `python -m pip install ./scripts/whisper-server[ocr]`.",
            "qualities": ["medium", "small"],
            "languages": ["ch", "chinese_cht"],
            "defaultQuality": "medium",
        }
    return {
        "available": True,
        "qualities": ["medium", "small"],
        "languages": ["ch", "chinese_cht"],
        "defaultQuality": "medium",
    }


class JobManager:
    def __init__(self, cache_root: Path = DEFAULT_CACHE_ROOT):
        self.cache_root = cache_root
        self.entries_root = cache_root / "entries"
        self.jobs: dict[str, Job] = {}
        self.queue: asyncio.Queue[Job] = asyncio.Queue()
        self.worker: asyncio.Task[None] | None = None
        self.lock = threading.Lock()

    async def start(self) -> None:
        self.entries_root.mkdir(parents=True, exist_ok=True)
        self.worker = asyncio.create_task(self._work())
        logger.info("Subtitle generation job worker started; cache directory: %s", self.cache_root)

    async def stop(self) -> None:
        if self.worker:
            self.worker.cancel()
            await asyncio.gather(self.worker, return_exceptions=True)

    def entry_path(self, entry_id: str) -> Path:
        return self.entries_root / entry_id

    def read_entry(self, entry_id: str) -> dict[str, Any] | None:
        metadata_path = self.entry_path(entry_id) / "metadata.json"
        try:
            return json.loads(metadata_path.read_text())
        except (FileNotFoundError, json.JSONDecodeError):
            return None

    @staticmethod
    def public_entry(metadata: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": metadata["id"],
            "label": metadata["label"],
            "fileName": metadata["fileName"],
            "createdAt": metadata["createdAt"],
            "sourceKey": metadata["sourceKey"],
        }

    async def create(self, request: CreateJobRequest) -> Job:
        try:
            options = validate_options(request.whisperOptions) if request.generator == "whisper" else {}
            ocr_options = validate_ocr_options(request.ocrOptions) if request.generator == "ocr" else None
            if request.generator == "ocr":
                capability = ocr_capabilities()
                if not capability["available"]:
                    raise ValueError(str(capability["error"]))
            normalized_url = normalize_url(request.sourceUrl)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

        # Never invoke yt-dlp from a request handler. In particular, a Colab
        # quick tunnel has a finite request timeout, while an extractor can
        # take much longer to resolve a video. The worker upgrades this
        # fallback identity to yt-dlp's canonical extractor/video identity.
        identity = fallback_source_identity(normalized_url)
        entry_id = cache_key(identity, options, request.generator, ocr_options)
        metadata = self._matching_cached_entry(normalized_url, request.generator, options, ocr_options)
        if metadata:
            entry_id = str(metadata["id"])
            identity = metadata.get("sourceIdentity") or identity
            logger.info("Whisper job cache hit for %s", entry_id[:12])
            return Job(
                id=f"cache-{entry_id[:12]}",
                source_url=request.sourceUrl,
                source_identity=identity,
                source_key=str(metadata.get("sourceKey") or source_key(identity)),
                cache_id=entry_id,
                options=options,
                generator=request.generator,
                ocr_options=ocr_options,
                state="completed",
                entry=self.public_entry(metadata),
            )

        for job in self.jobs.values():
            if (
                normalize_url(job.source_url) == normalized_url
                and job.generator == request.generator
                and self._output_signature(job) == self._output_signature_values(request.generator, options, ocr_options)
                and job.state in {"queued", "downloading", "loading-model", "transcribing", "analyzing-video", "recognizing-text"}
            ):
                logger.info("Whisper job %s already exists for this source", job.id)
                return job

        job = Job(
            id=uuid.uuid4().hex,
            source_url=request.sourceUrl,
            source_identity=identity,
            source_key=source_key(identity),
            cache_id=entry_id,
            options=options,
            generator=request.generator,
            ocr_options=ocr_options,
        )
        self.jobs[job.id] = job
        await self.queue.put(job)
        logger.info("Subtitle job %s queued (generator=%s)", job.id, job.generator)
        return job

    @staticmethod
    def _output_signature_values(
        generator: Literal["whisper", "ocr"], options: dict[str, Any], ocr_options: dict[str, Any] | None
    ) -> dict[str, Any]:
        if generator == "ocr":
            return {"generator": generator, "ocrOptions": ocr_options, "pipeline": OCR_PIPELINE_VERSION}
        return {"generator": generator, "whisperOptions": output_options(options)}

    def _output_signature(self, job: Job) -> dict[str, Any]:
        return self._output_signature_values(job.generator, job.options, job.ocr_options)

    async def _work(self) -> None:
        while True:
            job = await self.queue.get()
            try:
                if job.cancel_requested.is_set():
                    job.state = "cancelled"
                    logger.info("Subtitle job %s cancelled before it started", job.id)
                else:
                    logger.info("Subtitle job %s started (generator=%s)", job.id, job.generator)
                    await asyncio.to_thread(self._run, job)
            finally:
                self.queue.task_done()

    def _run(self, job: Job) -> None:
        try:
            with tempfile.TemporaryDirectory(prefix="asbplayer-whisper-") as temporary_directory:
                temporary_path = Path(temporary_directory)
                input_file = (
                    self._download_audio(job, temporary_path)
                    if job.generator == "whisper"
                    else self._download_video(job, temporary_path)
                )
                logger.info("Subtitle job %s downloaded input (%d bytes)", job.id, input_file.stat().st_size)
                if job.cancel_requested.is_set():
                    job.state = "cancelled"
                    logger.info("Whisper job %s cancelled after download", job.id)
                    return
                existing_entry = self.read_entry(job.cache_id)
                if existing_entry:
                    job.entry = self.public_entry(existing_entry)
                    job.state = "completed"
                    logger.info("Whisper job %s found canonical cache entry %s", job.id, job.cache_id[:12])
                    return
                if job.generator == "whisper":
                    self._transcribe(job, input_file, temporary_path)
                else:
                    self._extract_ocr(job, input_file, temporary_path)
                if job.cancel_requested.is_set():
                    job.state = "cancelled"
                    logger.info("Whisper job %s cancelled during transcription", job.id)
                    return
                subtitle_file = (
                    next(temporary_path.glob("output/**/*.srt"), None)
                    if job.generator == "whisper"
                    else temporary_path / "output" / "subtitles.srt"
                )
                if subtitle_file is None:
                    raise RuntimeError("Whisper completed without producing an SRT file")
                job.entry = self._store_entry(job, subtitle_file)
                job.state = "completed"
                logger.info("Subtitle job %s completed and cached as %s", job.id, job.cache_id[:12])
        except Exception as error:
            job.state = "cancelled" if job.cancel_requested.is_set() else "failed"
            if job.state == "failed":
                job.error = str(error)
                logger.exception("Subtitle job %s failed: %s", job.id, error)
            else:
                logger.info("Subtitle job %s cancelled", job.id)
        finally:
            job.process = None
            logger.info("Subtitle job %s finished with state=%s", job.id, job.state)

    def _download_audio(self, job: Job, temporary_path: Path) -> Path:
        import yt_dlp
        from yt_dlp.utils import DownloadError

        job.state = "downloading"
        logger.info("Whisper job %s is downloading audio", job.id)

        def progress_hook(progress: dict[str, Any]) -> None:
            if job.cancel_requested.is_set():
                raise RuntimeError("Download cancelled")
            if progress.get("status") == "downloading":
                total = progress.get("total_bytes") or progress.get("total_bytes_estimate")
                downloaded = progress.get("downloaded_bytes", 0)
                if total:
                    job.progress = max(0, min(100, round(downloaded / total * 100)))
                    if (
                        job.last_reported_progress is None
                        or job.progress >= job.last_reported_progress + 10
                        or job.progress == 100
                    ):
                        logger.info("Whisper job %s audio download: %d%%", job.id, job.progress)
                        job.last_reported_progress = job.progress

        options = {
            "format": "bestaudio/best",
            "noplaylist": True,
            "outtmpl": str(temporary_path / "audio.%(ext)s"),
            "quiet": True,
            "no_warnings": True,
            "progress_hooks": [progress_hook],
        }
        try:
            with yt_dlp.YoutubeDL(options) as downloader:
                info = downloader.extract_info(job.source_url, download=True)
                job.source_identity = source_identity_from_downloader_info(job.source_url, info)
                job.source_key = source_key(job.source_identity)
                job.cache_id = cache_key(job.source_identity, job.options)
                logger.info(
                    "Whisper job %s resolved source as %s/%s",
                    job.id,
                    job.source_identity["extractor"],
                    job.source_identity["id"],
                )
                requested = info.get("requested_downloads") or []
                if requested and requested[0].get("filepath"):
                    return Path(requested[0]["filepath"])
                expected = Path(downloader.prepare_filename(info))
        except DownloadError as error:
            raise RuntimeError(
                "yt-dlp could not download audio from this video. Update yt-dlp and ensure yt-dlp-ejs plus a "
                "supported JavaScript runtime (such as Node.js) are installed. "
                f"Detail: {error}"
            ) from error
        if expected.exists():
            return expected
        audio_files = [path for path in temporary_path.glob("audio.*") if path.is_file()]
        if not audio_files:
            raise RuntimeError("yt-dlp did not download an audio file")
        return audio_files[0]

    def _download_video(self, job: Job, temporary_path: Path) -> Path:
        """Download a viewable stream suitable for OCR without fetching a 4K source."""
        import yt_dlp
        from yt_dlp.utils import DownloadError

        job.state = "downloading"
        job.progress = None
        job.last_reported_progress = None
        logger.info("OCR job %s is downloading video", job.id)

        def progress_hook(progress: dict[str, Any]) -> None:
            if job.cancel_requested.is_set():
                raise RuntimeError("Download cancelled")
            if progress.get("status") != "downloading":
                return
            total = progress.get("total_bytes") or progress.get("total_bytes_estimate")
            downloaded = progress.get("downloaded_bytes", 0)
            if total:
                job.progress = max(0, min(100, round(downloaded / total * 100)))

        options = {
            "format": "bestvideo[height<=1080]/best[height<=1080]/best",
            "noplaylist": True,
            "outtmpl": str(temporary_path / "video.%(ext)s"),
            "quiet": True,
            "no_warnings": True,
            "progress_hooks": [progress_hook],
        }
        try:
            with yt_dlp.YoutubeDL(options) as downloader:
                info = downloader.extract_info(job.source_url, download=True)
                job.source_identity = source_identity_from_downloader_info(job.source_url, info)
                job.source_key = source_key(job.source_identity)
                job.cache_id = cache_key(job.source_identity, job.options, job.generator, job.ocr_options)
                requested = info.get("requested_downloads") or []
                if requested and requested[0].get("filepath"):
                    return Path(requested[0]["filepath"])
                expected = Path(downloader.prepare_filename(info))
        except DownloadError as error:
            raise RuntimeError(
                "yt-dlp could not download video from this source. OCR requires a non-DRM video stream; update yt-dlp "
                "and ensure yt-dlp-ejs plus a supported JavaScript runtime (such as Node.js) are installed. "
                f"Detail: {error}"
            ) from error
        if expected.exists():
            return expected
        video_files = [path for path in temporary_path.glob("video.*") if path.is_file()]
        if not video_files:
            raise RuntimeError("yt-dlp did not download a video stream suitable for OCR")
        return video_files[0]

    @staticmethod
    def _format_srt_timestamp(seconds: float) -> str:
        milliseconds = max(0, round(seconds * 1000))
        hours, remainder = divmod(milliseconds, 3_600_000)
        minutes, remainder = divmod(remainder, 60_000)
        seconds_part, milliseconds = divmod(remainder, 1_000)
        return f"{hours:02}:{minutes:02}:{seconds_part:02},{milliseconds:03}"

    @staticmethod
    def _ocr_text(result: Any) -> str | None:
        """Turn PaddleOCR v3 pipeline output into ordered subtitle lines."""
        if isinstance(result, dict):
            result = result.get("res", result)
        if not isinstance(result, dict):
            return None
        texts = result.get("rec_texts") or []
        scores = result.get("rec_scores") or []
        polygons = result.get("rec_polys") or []
        rows: list[tuple[float, float, str]] = []
        for index, text in enumerate(texts):
            if not isinstance(text, str) or not text.strip():
                continue
            score = scores[index] if index < len(scores) else 0
            if not isinstance(score, (int, float)) or score < OCR_CONFIDENCE_THRESHOLD:
                continue
            polygon = polygons[index] if index < len(polygons) else []
            try:
                y = sum(float(point[1]) for point in polygon) / len(polygon)
                x = sum(float(point[0]) for point in polygon) / len(polygon)
            except (TypeError, IndexError, ZeroDivisionError):
                y, x = float(index), 0.0
            rows.append((y, x, re.sub(r"\s+", "", text)))
        if not rows:
            return None
        rows.sort()
        line_groups: list[list[tuple[float, float, str]]] = []
        for row in rows:
            if not line_groups or abs(row[0] - line_groups[-1][0][0]) > 24:
                line_groups.append([row])
            else:
                line_groups[-1].append(row)
        return "\n".join("".join(part[2] for part in sorted(line, key=lambda value: value[1])) for line in line_groups)

    @classmethod
    def _srt_from_ocr_samples(cls, samples: list[tuple[float, str | None]]) -> str:
        """Require two matching samples, then make one cue per stable text run."""
        half_interval = 1 / (OCR_SAMPLE_RATE * 2)
        cues: list[tuple[float, float, str]] = []
        run_text: str | None = None
        run_start = 0.0
        run_end = 0.0
        run_count = 0

        def emit() -> None:
            if run_text is None or run_count < 2:
                return
            start = max(0, run_start - half_interval)
            end = run_end + half_interval
            if cues:
                start = max(start, cues[-1][1])
            if end > start:
                cues.append((start, end, run_text))

        for timestamp, text in samples:
            if text == run_text and text is not None:
                run_end = timestamp
                run_count += 1
                continue
            emit()
            run_text = text
            run_start = timestamp
            run_end = timestamp
            run_count = 1 if text is not None else 0
        emit()
        return "\n\n".join(
            f"{index}\n{cls._format_srt_timestamp(start)} --> {cls._format_srt_timestamp(end)}\n{text}"
            for index, (start, end, text) in enumerate(cues, start=1)
        ) + ("\n" if cues else "")

    def _extract_ocr(self, job: Job, video_file: Path, temporary_path: Path) -> None:
        try:
            import cv2
            from paddleocr import PaddleOCR
        except ImportError as error:
            raise RuntimeError(
                "OCR support is not installed. Reinstall with `python -m pip install ./scripts/whisper-server[ocr]`."
            ) from error
        if job.ocr_options is None:
            raise RuntimeError("OCR job has no OCR options")

        job.state = "loading-model"
        job.progress = None
        job.remaining_seconds = None
        ocr = PaddleOCR(
            lang=job.ocr_options["language"],
            ocr_version="PP-OCRv6",
            text_detection_model_name=f"{OCR_QUALITIES[job.ocr_options['quality']]}_det",
            text_recognition_model_name=f"{OCR_QUALITIES[job.ocr_options['quality']]}_rec",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
        capture = cv2.VideoCapture(str(video_file))
        if not capture.isOpened():
            raise RuntimeError("FFmpeg/OpenCV could not decode the downloaded video")
        source_fps = capture.get(cv2.CAP_PROP_FPS) or OCR_SAMPLE_RATE
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        step = max(1, round(source_fps / OCR_SAMPLE_RATE))
        total_samples = max(1, (frame_count + step - 1) // step)
        crop = job.ocr_options["crop"]
        samples: list[tuple[float, str | None]] = []
        frame_index = 0
        sampled = 0
        job.state = "analyzing-video"
        try:
            while True:
                ok, frame = capture.read()
                if not ok:
                    break
                if frame_index % step:
                    frame_index += 1
                    continue
                if job.cancel_requested.is_set():
                    return
                height, width = frame.shape[:2]
                left = round(width * crop["left"])
                top = round(height * crop["top"])
                right = min(width, left + max(1, round(width * crop["width"])))
                bottom = min(height, top + max(1, round(height * crop["height"])))
                frame_crop = frame[top:bottom, left:right]
                job.state = "recognizing-text"
                prediction = next(iter(ocr.predict(frame_crop)), None)
                samples.append((frame_index / source_fps, self._ocr_text(prediction)))
                sampled += 1
                job.progress = max(0, min(100, round(sampled / total_samples * 100)))
                job.completed_frames = sampled
                job.total_frames = total_samples
                frame_index += 1
        finally:
            capture.release()
        if job.cancel_requested.is_set():
            return
        output_directory = temporary_path / "output"
        output_directory.mkdir(exist_ok=True)
        (output_directory / "subtitles.srt").write_text(self._srt_from_ocr_samples(samples), encoding="utf-8")
        job.progress = 100

    def _transcribe(self, job: Job, audio_file: Path, temporary_path: Path) -> None:
        job.state = "loading-model"
        job.progress = None
        job.last_reported_progress = None
        job.remaining_seconds = None
        job.completed_frames = None
        job.total_frames = None
        job.model_downloaded = None
        job.model_total = None
        output_directory = temporary_path / "output"
        output_directory.mkdir()
        executable = shutil.which("whisper")
        if executable is None:
            raise RuntimeError("The Whisper CLI is not installed. Reinstall the local Whisper service.")
        command = [
            executable,
            str(audio_file),
            "--output_dir",
            str(output_directory),
            "--output_format",
            "srt",
            "--verbose",
            "False",
        ]
        for spec in OPTION_SPECS:
            value = job.options[spec.name]
            if value is None:
                continue
            command.extend([f"--{spec.name}", str(value)])
        logger.info(
            "Whisper job %s is loading model=%s (task=%s, language=%s, device=%s)",
            job.id,
            job.options["model"],
            job.options["task"],
            job.options["language"] or "auto",
            job.options["device"],
        )
        logger.info("Whisper job %s will report native model-download and frame progress estimates", job.id)
        whisper_environment = os.environ.copy()
        whisper_environment["PYTHONUNBUFFERED"] = "1"
        job.process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=whisper_environment,
        )
        output_lines: deque[str] = deque(maxlen=100)

        def update_model_progress(progress: int, downloaded: str, total: str, remaining_seconds: int | None) -> None:
            job.state = "loading-model"
            job.progress = progress
            job.model_downloaded = downloaded
            job.model_total = total
            job.remaining_seconds = remaining_seconds
            if (
                job.last_reported_progress is None
                or progress >= job.last_reported_progress + 5
                or progress == 100
            ):
                logger.info(
                    "Whisper job %s native model download: %s/%s (%d%%)%s",
                    job.id,
                    downloaded,
                    total,
                    progress,
                    f", {remaining_seconds}s remaining" if remaining_seconds is not None else "",
                )
                job.last_reported_progress = progress

        def update_progress(completed_frames: int, total_frames: int, remaining_seconds: int | None = None) -> None:
            if job.state != "transcribing":
                job.state = "transcribing"
                job.last_reported_progress = None
                job.remaining_seconds = None
                job.model_downloaded = None
                job.model_total = None
            job.completed_frames = completed_frames
            job.total_frames = total_frames
            progress = max(0, min(100, round(completed_frames / total_frames * 100)))
            job.progress = progress
            if remaining_seconds is not None:
                job.remaining_seconds = remaining_seconds
            elif progress == 100:
                job.remaining_seconds = 0
            if (
                job.last_reported_progress is None
                or progress >= job.last_reported_progress + 5
                or progress == 100
            ):
                logger.info(
                    "Whisper job %s native frame progress: %s/%s (%d%%)%s",
                    job.id,
                    f"{completed_frames:,}",
                    f"{total_frames:,}",
                    progress,
                    f", {remaining_seconds}s remaining" if remaining_seconds is not None else "",
                )
                job.last_reported_progress = progress

        def handle_whisper_line(line: str) -> None:
            line = line.strip()
            if not line:
                return
            output_lines.append(line)
            model_download = whisper_tqdm_model_download(line)
            if model_download is not None:
                update_model_progress(*model_download, whisper_tqdm_remaining_seconds(line))
                return
            frame_counts = whisper_tqdm_frame_counts(line)
            if frame_counts is not None:
                update_progress(*frame_counts, whisper_tqdm_remaining_seconds(line))
                return
            logger.info("Whisper job %s: %s", job.id, line)

        def log_whisper_output() -> None:
            if job.process is None or job.process.stdout is None:
                return
            buffered_output = ""
            while output := job.process.stdout.read1(1024):
                buffered_output += output.decode(errors="replace")
                lines = re.split(r"[\r\n]", buffered_output)
                buffered_output = lines.pop()
                for line in lines:
                    handle_whisper_line(line)
            handle_whisper_line(buffered_output)

        output_thread = threading.Thread(target=log_whisper_output, name=f"whisper-output-{job.id}", daemon=True)
        output_thread.start()
        while job.process.poll() is None:
            if job.cancel_requested.wait(0.25):
                job.process.terminate()
                try:
                    job.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    job.process.kill()
                output_thread.join(timeout=1)
                return
        output_thread.join(timeout=1)
        if job.process.returncode != 0:
            error_output = "\n".join(list(output_lines)[-10:]).strip()
            raise RuntimeError(error_output or f"Whisper exited with code {job.process.returncode}")
        job.progress = 100
        job.remaining_seconds = 0
        logger.info("Whisper job %s finished transcribing", job.id)

    def _store_entry(self, job: Job, subtitle_file: Path) -> dict[str, Any]:
        created_at = datetime.now(timezone.utc).isoformat()
        if job.generator == "ocr":
            assert job.ocr_options is not None
            language = "Traditional Chinese" if job.ocr_options["language"] == "chinese_cht" else "Chinese"
            label = f"OCR subtitles — PP-OCRv6 {job.ocr_options['quality'].title()} ({language})"
        else:
            language = job.options["language"] or "auto"
            label = f"Generated subtitles — {job.options['model']} ({language}, {job.options['task']})"
        file_name = "generated-subtitles.srt"
        metadata = {
            "id": job.cache_id,
            "label": label,
            "fileName": file_name,
            "createdAt": created_at,
            "sourceKey": job.source_key,
            "sourceIdentity": job.source_identity,
            "sourceUrl": normalize_url(job.source_url),
            "generator": job.generator,
            "whisperOptions": job.options if job.generator == "whisper" else None,
            "ocrOptions": job.ocr_options,
            "ocrPipelineVersion": OCR_PIPELINE_VERSION if job.generator == "ocr" else None,
        }
        destination = self.entry_path(job.cache_id)
        temporary_destination = self.entries_root / f".{job.cache_id}-{uuid.uuid4().hex}"
        temporary_destination.mkdir(parents=True)
        shutil.copyfile(subtitle_file, temporary_destination / "subtitles.srt")
        (temporary_destination / "metadata.json").write_text(json.dumps(metadata, indent=2, sort_keys=True))
        if not destination.exists():
            os.replace(temporary_destination, destination)
        else:
            shutil.rmtree(temporary_destination)
        logger.info("Whisper job %s saved cache entry %s", job.id, job.cache_id[:12])
        return self.public_entry(self.read_entry(job.cache_id) or metadata)

    def _matching_cached_entry(
        self,
        normalized_url: str,
        generator: Literal["whisper", "ocr"],
        options: dict[str, Any],
        ocr_options: dict[str, Any] | None,
    ) -> dict[str, Any] | None:
        expected_options = output_options(options)
        for metadata_path in self.entries_root.glob("*/metadata.json"):
            try:
                metadata = json.loads(metadata_path.read_text())
            except json.JSONDecodeError:
                continue
            if metadata.get("sourceUrl") != normalized_url:
                continue
            entry_generator = metadata.get("generator", "whisper")
            if entry_generator != generator:
                continue
            if generator == "ocr":
                if (
                    metadata.get("ocrOptions") == ocr_options
                    and metadata.get("ocrPipelineVersion") == OCR_PIPELINE_VERSION
                ):
                    return metadata
                continue
            cached_options = metadata.get("whisperOptions")
            if isinstance(cached_options, dict) and all(
                cached_options.get(name) == value for name, value in expected_options.items()
            ):
                return metadata
        return None

    async def cached(self, source_url: str) -> list[dict[str, Any]]:
        try:
            normalized_url = normalize_url(source_url)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        entries: list[dict[str, Any]] = []
        for metadata_path in self.entries_root.glob("*/metadata.json"):
            try:
                metadata = json.loads(metadata_path.read_text())
            except json.JSONDecodeError:
                continue
            if metadata.get("sourceUrl") == normalized_url:
                entries.append(self.public_entry(metadata))
        return sorted(entries, key=lambda entry: entry["createdAt"], reverse=True)

    def get(self, job_id: str) -> Job:
        job = self.jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Subtitle generation job not found")
        return job

    def cancel(self, job_id: str) -> Job:
        job = self.get(job_id)
        job.cancel_requested.set()
        if job.state == "queued":
            job.state = "cancelled"
        logger.info("Whisper job %s cancellation requested", job.id)
        return job


manager = JobManager()
app = FastAPI(title="asbplayer Subtitle Generation Server", version="1", dependencies=[Depends(require_authentication)])


@app.on_event("startup")
async def startup() -> None:
    await manager.start()


@app.on_event("shutdown")
async def shutdown() -> None:
    await manager.stop()


@app.get("/v1/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/capabilities")
async def capabilities() -> dict[str, Any]:
    try:
        import whisper

        whisper_version = getattr(whisper, "__version__", "unknown")
    except ImportError:
        whisper_version = "not installed"
    return {
        "whisperVersion": whisper_version,
        "options": [spec.public() for spec in OPTION_SPECS],
        "ocr": ocr_capabilities(),
    }


@app.post("/v1/jobs")
async def create_job(request: CreateJobRequest) -> dict[str, Any]:
    return (await manager.create(request)).public()


@app.get("/v1/jobs/{job_id}")
async def get_job(job_id: str) -> dict[str, Any]:
    return manager.get(job_id).public()


@app.delete("/v1/jobs/{job_id}")
async def cancel_job(job_id: str) -> dict[str, Any]:
    return manager.cancel(job_id).public()


@app.get("/v1/cache")
async def get_cached(sourceUrl: str) -> list[dict[str, Any]]:
    return await manager.cached(sourceUrl)


@app.get("/v1/cache/{entry_id}/srt")
async def get_srt(entry_id: str) -> Response:
    metadata = manager.read_entry(entry_id)
    subtitle_file = manager.entry_path(entry_id) / "subtitles.srt"
    if not metadata or not subtitle_file.is_file():
        raise HTTPException(status_code=404, detail="Generated subtitle cache entry not found")
    return Response(
        subtitle_file.read_bytes(),
        media_type="application/x-subrip",
        headers={"Content-Disposition": f'attachment; filename="{metadata["fileName"]}"'},
    )


def main() -> None:
    import uvicorn

    parser = argparse.ArgumentParser(description="Run the asbplayer Whisper subtitle service.")
    parser.add_argument("--host", default=os.environ.get("ASBPLAYER_WHISPER_HOST", "127.0.0.1"))
    parser.add_argument("--port", default=os.environ.get("ASBPLAYER_WHISPER_PORT", "8767"), type=int)
    arguments = parser.parse_args()

    if not is_loopback_host(arguments.host) and configured_auth_token() is None:
        parser.error(
            f"Set {AUTH_TOKEN_ENVIRONMENT_VARIABLE} before binding the Whisper service outside loopback."
        )

    uvicorn.run(app, host=arguments.host, port=arguments.port)


if __name__ == "__main__":
    main()

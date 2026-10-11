import asyncio
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from asbplayer_whisper_server.main import (
    CreateJobRequest,
    Job,
    JobManager,
    cache_key,
    fallback_source_identity,
    normalize_url,
    request_is_authorized,
    source_identity_from_downloader_info,
    source_key,
    validate_options,
    whisper_tqdm_frame_counts,
    whisper_tqdm_model_download,
    whisper_tqdm_remaining_seconds,
)


class WhisperServerTests(unittest.TestCase):
    def test_normalizes_equivalent_urls(self):
        self.assertEqual(
            normalize_url("https://www.youtube.com/watch?b=2&a=1#player"),
            "https://www.youtube.com/watch?a=1&b=2",
        )

    def test_rejects_unknown_options(self):
        with self.assertRaisesRegex(ValueError, "Unsupported Whisper option"):
            validate_options({"not-a-whisper-option": True})

    def test_rejects_service_owned_verbose_option(self):
        with self.assertRaisesRegex(ValueError, "Unsupported Whisper option"):
            validate_options({"verbose": True})

    def test_omits_empty_optional_text_options(self):
        options = validate_options({"language": "", "initial_prompt": "   ", "model_dir": ""})

        self.assertIsNone(options["language"])
        self.assertIsNone(options["initial_prompt"])
        self.assertIsNone(options["model_dir"])

    def test_requires_the_configured_bearer_token(self):
        self.assertTrue(request_is_authorized(None, None))
        self.assertFalse(request_is_authorized(None, "secret"))
        self.assertFalse(request_is_authorized("Basic secret", "secret"))
        self.assertFalse(request_is_authorized("Bearer wrong", "secret"))
        self.assertTrue(request_is_authorized("Bearer secret", "secret"))

    def test_runtime_options_do_not_change_cache_key(self):
        identity = {"extractor": "Youtube", "id": "video-id", "url": "https://example.test/watch?v=video-id"}
        standard = validate_options({"model": "small", "device": "cpu"})
        accelerated = validate_options({"model": "small", "device": "cuda", "threads": 8})
        different_model = validate_options({"model": "medium", "device": "cpu"})

        self.assertEqual(source_key(identity), source_key(identity))
        self.assertEqual(cache_key(identity, standard), cache_key(identity, accelerated))
        self.assertNotEqual(cache_key(identity, standard), cache_key(identity, different_model))

    def test_derives_the_canonical_identity_from_the_download_result(self):
        self.assertEqual(
            source_identity_from_downloader_info(
                "https://www.youtube.com/watch?v=video-id",
                {"extractor_key": "Youtube", "id": "video-id"},
            ),
            {
                "extractor": "Youtube",
                "id": "video-id",
                "url": "https://www.youtube.com/watch?v=video-id",
            },
        )

    def test_queues_jobs_without_waiting_for_yt_dlp_metadata(self):
        source_url = "https://www.youtube.com/watch?v=video-id"
        with tempfile.TemporaryDirectory() as cache_root:
            manager = JobManager(Path(cache_root))
            job = asyncio.run(manager.create(CreateJobRequest(sourceUrl=source_url)))

        normalized_url = normalize_url(source_url)
        self.assertEqual(job.state, "queued")
        self.assertEqual(job.source_identity, fallback_source_identity(normalized_url))
        self.assertEqual(job.cache_id, cache_key(fallback_source_identity(normalized_url), job.options))

    def test_reports_transcription_progress_from_whisper_frame_counter(self):
        self.assertEqual(
            whisper_tqdm_frame_counts(" 36%|###6      | 2,200/6,060 [00:10<00:17, 215.65frames/s]"),
            (2200, 6060),
        )
        self.assertEqual(
            whisper_tqdm_frame_counts("100%|##########| 6060/6060 [00:21<00:00, 295.05frames/s]"),
            (6060, 6060),
        )
        self.assertIsNone(whisper_tqdm_frame_counts("Detected language: Turkish"))

    def test_reports_progress_from_whisper_model_download(self):
        self.assertEqual(
            whisper_tqdm_model_download(" 25%|##5       | 380M/1.48G [00:00<00:00, 15.9TiB/s]"),
            (25, "380M", "1.48G"),
        )
        self.assertEqual(
            whisper_tqdm_model_download("  0%|          | 0.00/1.48G [00:00<?, ?iB/s]"),
            (0, "0.00", "1.48G"),
        )
        self.assertIsNone(whisper_tqdm_model_download(" 36%|###6      | 2,200/6,060 [00:10<00:17, 215.65frames/s]"))

    def test_reports_remaining_time_from_whisper_frame_counter(self):
        self.assertEqual(
            whisper_tqdm_remaining_seconds(" 36%|###6      | 2,200/6,060 [00:10<01:17, 215.65frames/s]"), 77
        )
        self.assertIsNone(whisper_tqdm_remaining_seconds("  0%|          | 0/6,060 [00:00<?, ?frames/s]"))

    def test_exposes_native_frame_counts_and_eta_in_job_status(self):
        job = Job(
            id="job-id",
            source_url="https://example.test/watch?v=video-id",
            source_identity={"extractor": "Example", "id": "video-id"},
            source_key="source-key",
            cache_id="cache-id",
            options={},
            state="transcribing",
            progress=36,
            completed_frames=2200,
            total_frames=6060,
            remaining_seconds=77,
        )

        self.assertEqual(
            job.public(),
            {
                "id": "job-id",
                "state": "transcribing",
                "progress": 36,
                "remainingSeconds": 77,
                "completedFrames": 2200,
                "totalFrames": 6060,
            },
        )

    def test_exposes_native_model_download_progress_in_job_status(self):
        job = Job(
            id="job-id",
            source_url="https://example.test/watch?v=video-id",
            source_identity={"extractor": "Example", "id": "video-id"},
            source_key="source-key",
            cache_id="cache-id",
            options={},
            state="loading-model",
            progress=25,
            model_downloaded="380M",
            model_total="1.48G",
            remaining_seconds=20,
        )

        self.assertEqual(
            job.public(),
            {
                "id": "job-id",
                "state": "loading-model",
                "progress": 25,
                "remainingSeconds": 20,
                "modelDownloaded": "380M",
                "modelTotal": "1.48G",
            },
        )


if __name__ == "__main__":
    unittest.main()

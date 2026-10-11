---
sidebar_position: 10
---

# Generate subtitles with Whisper

asbplayer can generate an SRT subtitle track for a streaming video using a Whisper service running on your own computer or an authenticated remote GPU service. The service downloads audio through `yt-dlp`, then Whisper uses FFmpeg to decode and preprocess it. asbplayer does not run this workload on its own servers.

YouTube is supported directly. Other streaming sites are supported when `yt-dlp` can extract their audio; DRM-protected and unsupported sites cannot be processed.

## Install the local service

Install [Python 3.10+](https://www.python.org/downloads/) and [FFmpeg](https://ffmpeg.org/download.html), then clone this repository and run:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install ./scripts/whisper-server
asbplayer-whisper-server
```

On Windows, activate the virtual environment with `.venv\\Scripts\\activate` instead. The first transcription downloads the selected Whisper model, which can take time and disk space.

For reliable YouTube support, install a JavaScript runtime as well (on macOS, `brew install node`). yt-dlp's extractors change frequently; if a source starts reporting an extraction or page-reload error, stop the service and update its downloader in the same virtual environment:

```bash
python -m pip install --upgrade --pre "yt-dlp[default,curl-cffi]" yt-dlp-ejs
asbplayer-whisper-server
```

The default service listens only on `http://127.0.0.1:8767`. Confirm that it is running with:

```bash
curl http://127.0.0.1:8767/v1/health
```

This service is separate from the optional WebSocket/AnkiConnect companion server.

## Use a remote GPU service

The extension defaults to the local service. To use a remote service, open **Settings** → **Streaming Video** → **Whisper subtitle service**, enter its HTTPS URL and bearer token, then choose **Save Whisper service**. Chrome asks for permission for that HTTPS host at this point.

- Remote services must use HTTPS and require a token. The extension sends it in the `Authorization: Bearer …` header for every service request.
- The token is stored only in local extension settings and is excluded from settings exports.
- Your video URL, downloaded audio, Whisper options, generated SRT, and cache are processed by the machine running the remote service. Do not use an endpoint you do not trust.
- The default local endpoint needs neither HTTPS nor a token.

To protect a server exposed beyond loopback, set `ASBPLAYER_WHISPER_AUTH_TOKEN` before starting it. The server refuses to bind to a non-loopback host without this variable:

```bash
export ASBPLAYER_WHISPER_AUTH_TOKEN='a-long-random-secret'
asbplayer-whisper-server --host 0.0.0.0
```

### Google Colab GPU setup

Google Colab is an experimental, temporary option rather than a reliable persistent server. Its runtime and cache are lost when the session stops, and a tunnel URL changes when it is restarted. Keep the notebook and its tunnel URL/token private.

1. Open `scripts/whisper-server/asbplayer-whisper-colab.ipynb` in Colab and select a GPU runtime.
2. Run every cell. It installs the server with CUDA as the default device, prompts you for a private token, and prints a temporary HTTPS tunnel URL.
3. Paste that URL and the token into **Whisper subtitle service** in extension settings, then choose **Save Whisper service**.
4. Generate subtitles normally. Keep the notebook connected until the job completes.

When Colab disconnects, rerun the notebook and update the remote URL/token in extension settings. For a persistent GPU cache and endpoint, use a VM or hosted GPU service that you control instead.

## Generate and reuse a subtitle track

1. Open asbplayer's **Select Subtitles** pop-out on a desktop streaming page.
2. Choose **Generate Subtitles** at the bottom.
3. Configure Whisper and choose **Generate**. The dialog reports audio download, Whisper model download/loading, and transcription state; canceling the dialog cancels its job.
4. When finished, the generated SRT is loaded automatically and the pop-out closes.

The service stores completed SRT files in its user cache directory. A revisit to the same video lists cached variants and selects the newest available result while that service remains available. Cache identity includes the video and output-affecting Whisper options, so changing a model or decoding setting creates a separate result while changing a runtime setting such as CPU thread count does not.

## Notes

- The generator is not available for local video files or mobile extension builds.
- The popup exposes every option from the version-pinned Whisper command line except input audio, output directory/format, and verbose output. asbplayer supplies the current page URL, always requests an SRT, and uses Whisper's native frame counter and time estimate for progress.
- Long videos can take substantial time, CPU/GPU memory, and disk space. The service runs one job at a time to avoid competing Whisper processes. Set `ASBPLAYER_WHISPER_DEVICE=cuda` before starting a GPU service to make CUDA its default device.

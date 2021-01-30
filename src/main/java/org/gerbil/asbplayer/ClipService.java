package org.gerbil.asbplayer;

import org.bytedeco.javacpp.Loader;
import org.gerbil.asbplayer.model.FileType;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

@Service
public class ClipService {

    private static final String TEMP_DIRECTORY = System.getProperty("java.io.tmpdir");

    private final FileProvider fileProvider;

    public ClipService(FileProvider fileProvider) {
        this.fileProvider = fileProvider;
    }

    public byte[] clipAudio(String path, long start, long end, String trackId) throws IOException, InterruptedException {
        String ffmpeg = Loader.load(org.bytedeco.ffmpeg.ffmpeg.class);
        var file = fileProvider.file(path);
        var fileType = FileType.forFile(file);
        var outputPathString = TEMP_DIRECTORY + "/audio_" + System.nanoTime() + ".mp3";
        ProcessBuilder pb;

        if (fileType == FileType.AUDIO) {
            pb = new ProcessBuilder(
                    ffmpeg,
                    "-ss",
                    formatInterval(start),
                    "-t",
                    formatInterval(end - start),
                    "-i",
                    file.getAbsolutePath(),
                    "-acodec",
                    "copy",
                    outputPathString
            );
        } else if (fileType == FileType.VIDEO) {
            if (trackId == null) {
                pb = new ProcessBuilder(
                        ffmpeg,
                        "-ss",
                        formatInterval(start),
                        "-t",
                        formatInterval(end - start),
                        "-i",
                        file.getAbsolutePath(),
                        "-vn",
                        "-ac",
                        "2",
                        "-ar",
                        "44100",
                        "-ab",
                        "192k",
                        "-f",
                        "mp3",
                        outputPathString
                );
            } else {
                pb = new ProcessBuilder(
                        ffmpeg,
                        "-ss",
                        formatInterval(start),
                        "-t",
                        formatInterval(end - start),
                        "-i",
                        file.getAbsolutePath(),
                        "-map",
                        "0:" + trackId,
                        "-ac",
                        "2",
                        "-ar",
                        "44100",
                        "-ab",
                        "192k",
                        "-f",
                        "mp3",
                        outputPathString
                );
            }
        } else {
            throw new IllegalArgumentException("Unsupported file type");
        }

        int exitCode = pb.inheritIO().start().waitFor();

        if (exitCode != 0) {
            throw new IllegalStateException("ffmpeg failed with exit code " + exitCode);
        }

        var outputPath = Path.of(outputPathString);
        var bytes = Files.readAllBytes(outputPath);
        Files.delete(outputPath);

        return bytes;
    }

    private String formatInterval(long milliseconds) {
        // https://stackoverflow.com/questions/6710094/how-to-format-an-elapsed-time-interval-in-hhmmss-sss-format-in-java
        final long hr = TimeUnit.MILLISECONDS.toHours(milliseconds);
        final long min = TimeUnit.MILLISECONDS.toMinutes(milliseconds - TimeUnit.HOURS.toMillis(hr));
        final long sec = TimeUnit.MILLISECONDS.toSeconds(milliseconds - TimeUnit.HOURS.toMillis(hr) - TimeUnit.MINUTES.toMillis(min));
        final long ms = TimeUnit.MILLISECONDS.toMillis(milliseconds - TimeUnit.HOURS.toMillis(hr) - TimeUnit.MINUTES.toMillis(min) - TimeUnit.SECONDS.toMillis(sec));
        return String.format("%02d:%02d:%02d.%03d", hr, min, sec, ms);
    }
}

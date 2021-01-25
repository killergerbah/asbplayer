package org.gerbil.asbplayer;

import org.bytedeco.javacpp.Loader;
import org.gerbil.asbplayer.model.FileType;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Service
public class ClipService {

    private static final String TEMP_DIRECTORY = System.getProperty("java.io.tmpdir");

    private final FileProvider fileProvider;

    public ClipService(FileProvider fileProvider) {
        this.fileProvider = fileProvider;
    }

    public byte[] clipAudio(String path, long start, long end) throws IOException, InterruptedException {
        String ffmpeg = Loader.load(org.bytedeco.ffmpeg.ffmpeg.class);
        var file = fileProvider.file(path);
        var fileType = FileType.forFile(file);
        var outputPathString = TEMP_DIRECTORY + "/audio_" + System.nanoTime() + ".mp3";
        ProcessBuilder pb;

        if (fileType == FileType.AUDIO) {
            pb = new ProcessBuilder(
                    ffmpeg,
                    "-ss",
                    toSeconds(start),
                    "-t",
                    toSeconds(end - start),
                    "-i",
                    file.getAbsolutePath(),
                    "-acodec",
                    "copy",
                    outputPathString
            );
        } else if (fileType == FileType.VIDEO) {
            pb = new ProcessBuilder(
                    ffmpeg,
                    "-ss",
                    toSeconds(start),
                    "-t",
                    toSeconds(end - start),
                    "-i",
                    file.getAbsolutePath(),
                    "-vn",
                    "-ar",
                    "44100",
                    "-ab",
                    "192k",
                    "-f",
                    "mp3",
                    outputPathString
            );
        } else {
            throw new IllegalArgumentException("Unsupported file type");
        }

        pb.inheritIO().start().waitFor();
        var outputPath = Path.of(outputPathString);
        var bytes = Files.readAllBytes(outputPath);
        Files.delete(outputPath);

        return bytes;
    }

    private String toSeconds(long milliseconds) {
        return milliseconds / 1000 + "." + (milliseconds % 1000);
    }
}

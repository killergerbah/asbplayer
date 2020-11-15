package org.gerbil.asbplayer;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Path;

@Service
public class FileProvider {

    private final File fileSystemRoot;

    public FileProvider(@Qualifier("root") File fileSystemRoot) {
        this.fileSystemRoot = fileSystemRoot;
    }

    public File file(String path) {
        var file = Path.of(fileSystemRoot.toPath().toString(), path).toFile();

        if (!file.exists()) {
            throw new FileNotFoundException();
        }

        return file;
    }
}

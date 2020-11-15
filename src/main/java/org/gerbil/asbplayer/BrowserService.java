package org.gerbil.asbplayer;

import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
public class BrowserService {

    private final FileProvider fileProvider;

    public BrowserService(FileProvider fileProvider) {
        this.fileProvider = fileProvider;
    }

    public List<String> list(String path) {
        var file = fileProvider.file(path);
        var fileList = file.list();

        if (fileList == null) {
            throw new IllegalArgumentException("Not a directory");
        }

        return Arrays.asList(fileList);
    }
}

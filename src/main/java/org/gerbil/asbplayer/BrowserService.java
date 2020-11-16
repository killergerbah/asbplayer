package org.gerbil.asbplayer;

import org.gerbil.asbplayer.model.File;
import org.gerbil.asbplayer.model.FileType;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class BrowserService {

    private final FileProvider fileProvider;

    public BrowserService(FileProvider fileProvider) {
        this.fileProvider = fileProvider;
    }

    public List<File> list(String path) {
        var file = fileProvider.file(path);
        var fileList = file.list();

        if (fileList == null) {
            throw new IllegalArgumentException("Not a directory");
        }

        return Arrays.stream(fileList)
                .flatMap(fileName -> {
                    var p = Path.of(path, fileName).toString();
                    var f = fileProvider.file(p);
                    var type = FileType.forFile(f);

                    if (type == null) {
                        return Stream.empty();
                    }

                    return Stream.of(new File(fileName, p, type));
                })
                .collect(Collectors.toList());
    }
}

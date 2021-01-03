package org.gerbil.asbplayer;

import org.gerbil.asbplayer.model.DirectoryItem;
import org.gerbil.asbplayer.model.File;
import org.gerbil.asbplayer.model.Item;
import org.gerbil.asbplayer.model.MediaItem;
import org.gerbil.asbplayer.model.FileType;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class BrowserService {

    private final FileProvider fileProvider;

    public BrowserService(FileProvider fileProvider) {
        this.fileProvider = fileProvider;
    }

    public List<Item> list(String directoryPath) {
        var directory = fileProvider.file(directoryPath);
        var fileNameList = directory.list();

        if (fileNameList == null) {
            throw new IllegalArgumentException("Not a directory");
        }

        var itemGroups = new HashMap<String, List<File>>(fileNameList.length);

        for (var fileName : fileNameList) {
            var path = Path.of(directoryPath, fileName).toString();
            var file = fileProvider.file(path);
            var fileType = FileType.forFile(file);

            if (fileType == null) {
                continue;
            }

            var filePath = Path.of(directoryPath, fileName).toString();
            var normalizedFileName = fileName.contains(".")
                    ? fileName.substring(0, fileName.lastIndexOf("."))
                    : fileName;
            itemGroups
                    .computeIfAbsent(normalizedFileName, k -> new ArrayList<>())
                    .add(new File(fileName, filePath, fileType));
        }

        return itemGroups.entrySet().stream()
                .flatMap(entry -> {
                    var groupName = entry.getKey();
                    var files = entry.getValue();

                    Optional<Item> directoryItem = files.stream()
                            .filter(f -> f.getType() == FileType.DIRECTORY)
                            .findFirst()
                            .map(f -> new DirectoryItem(f.getName(), f.getPath()));

                    var audioFile = files.stream()
                            .filter(f -> f.getType() == FileType.AUDIO)
                            .findFirst();

                    var videoFile = files.stream()
                            .filter(f -> f.getType() == FileType.VIDEO)
                            .findFirst();

                    var subtitleFile = files.stream()
                            .filter(f -> f.getType() == FileType.SUBTITLE)
                            .findFirst();

                    Optional<Item> mediaItem = audioFile.isPresent() || videoFile.isPresent() || subtitleFile.isPresent()
                            ? Optional.of(new MediaItem(groupName, audioFile.orElse(null), videoFile.orElse(null), subtitleFile.orElse(null)))
                            : Optional.empty();

                    return Stream.concat(mediaItem.stream(), directoryItem.stream());
                })
                .sorted(Comparator.comparing(Item::getName))
                .collect(Collectors.toList());
    }
}

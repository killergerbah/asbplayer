package org.gerbil.asbplayer;

import org.gerbil.jsubtitle.ass.AssFile;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Repository;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;

@Repository
public class SubtitleRepository {

    private final FileProvider fileProvider;

    public SubtitleRepository(FileProvider fileProvider) {
        this.fileProvider = fileProvider;
    }

    public List<Subtitle> getSubtitles(String path) {
        try {
            var assFile = AssFile.read(fileProvider.file(path));
            return assFile.getEventSection().getEvents().stream()
                    .map(e -> new Subtitle(e.getText(), e.getStart(), e.getEnd()))
                    .collect(Collectors.toList());
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}

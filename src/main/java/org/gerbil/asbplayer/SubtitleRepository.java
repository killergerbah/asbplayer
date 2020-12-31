package org.gerbil.asbplayer;

import org.gerbil.asbplayer.model.Subtitle;
import org.gerbil.jsubtitle.ass.AssFile;
import org.gerbil.jsubtitle.srt.SrtSubtitle;
import org.springframework.stereotype.Repository;

import java.io.IOException;
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
            if (path.endsWith(".ass")) {
                var assFile = AssFile.read(fileProvider.file(path));
                return assFile.getEventSection().getEvents().stream()
                        .map(e -> new Subtitle(e.getText(), e.getStart(), e.getEnd()))
                        .collect(Collectors.toList());
            }

            if (path.endsWith(".srt")) {
                return SrtSubtitle.read(fileProvider.file(path)).stream()
                        .map(s -> new Subtitle(s.getText(), s.getStart(), s.getEnd()))
                        .collect(Collectors.toList());
            }

            throw new IllegalArgumentException("Unknown subtitle extension");
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}

package org.gerbil.asbplayer;

import java.util.List;

public final class SubtitleResponse {

    private final List<Subtitle> subtitles;

    public SubtitleResponse(List<Subtitle> subtitles) {
        this.subtitles = subtitles;
    }

    public List<Subtitle> getSubtitles() {
        return subtitles;
    }
}

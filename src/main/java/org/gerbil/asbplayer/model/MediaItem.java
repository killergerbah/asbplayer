package org.gerbil.asbplayer.model;

public final class MediaItem implements Item {

    private final String name;
    private final File audioFile;
    private final File subtitleFile;

    public MediaItem(String name, File audioFile, File subtitleFile) {
        this.name = name;
        this.audioFile = audioFile;
        this.subtitleFile = subtitleFile;
    }

    @Override
    public String getName() {
        return name;
    }

    public File getAudioFile() {
        return audioFile;
    }

    public File getSubtitleFile() {
        return subtitleFile;
    }
}

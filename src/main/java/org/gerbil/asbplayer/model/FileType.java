package org.gerbil.asbplayer.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum FileType {

    SUBTITLE("subtitle"),
    AUDIO("audio"),
    VIDEO("video"),
    DIRECTORY("directory");

    private final String name;

    FileType(String name) {
        this.name = name;
    }

    public static FileType forFile(java.io.File file) {
        if (file.isDirectory()) {
            return DIRECTORY;
        }

        var fileName = file.getName();

        if (fileName.endsWith(".ass") || fileName.endsWith(".srt")) {
            return SUBTITLE;
        }

        if (fileName.endsWith(".mp3")) {
            return AUDIO;
        }

        if (fileName.endsWith(".mkv")) {
            return VIDEO;
        }

        return null;
    }

    @JsonValue
    public String getName() {
        return name;
    }
}

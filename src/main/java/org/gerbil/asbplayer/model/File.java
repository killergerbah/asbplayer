package org.gerbil.asbplayer.model;

public final class File {

    private final String name;
    private final String path;
    private final FileType type;

    public File(String name, String path, FileType type) {
        this.name = name;
        this.path = path;
        this.type = type;
    }

    public String getName() {
        return name;
    }

    public String getPath() {
        return path;
    }

    public FileType getType() {
        return type;
    }
}

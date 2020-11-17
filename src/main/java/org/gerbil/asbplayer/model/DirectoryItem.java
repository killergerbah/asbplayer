package org.gerbil.asbplayer.model;

public final class DirectoryItem implements Item {

    private final String name;
    private final String path;

    public DirectoryItem(String name, String path) {
        this.name = name;
        this.path = path;
    }

    @Override
    public String getName() {
        return name;
    }

    public String getPath() {
        return path;
    }
}

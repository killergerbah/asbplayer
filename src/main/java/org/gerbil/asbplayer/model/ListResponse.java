package org.gerbil.asbplayer.model;

import java.util.List;

public final class ListResponse {

    private final List<File> files;

    public ListResponse(List<File> files) {
        this.files = files;
    }

    public List<File> getFiles() {
        return files;
    }
}

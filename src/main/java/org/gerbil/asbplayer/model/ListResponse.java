package org.gerbil.asbplayer.model;

import java.util.List;

public final class ListResponse {

    private final List<Item> items;

    public ListResponse(List<Item> items) {
        this.items = items;
    }

    public List<Item> getItems() {
        return items;
    }
}

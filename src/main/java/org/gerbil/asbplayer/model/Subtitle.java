package org.gerbil.asbplayer.model;

public final class Subtitle {

    private final String text;
    private final long start;
    private final long end;

    public Subtitle(String text, long start, long end) {
        this.text = text;
        this.start = start;
        this.end = end;
    }

    public String getText() {
        return text;
    }

    public long getStart() {
        return start;
    }

    public long getEnd() {
        return end;
    }
}

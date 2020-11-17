package org.gerbil.asbplayer.model;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

@JsonTypeInfo(
        use=JsonTypeInfo.Id.NAME,
        property="type"
)
@JsonSubTypes({
        @JsonSubTypes.Type(value=MediaItem.class, name="media"),
        @JsonSubTypes.Type(value=DirectoryItem.class, name="directory")
})
public interface Item {

    String getName();
}

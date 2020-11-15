package org.gerbil.asbplayer;

import org.springframework.content.commons.repository.Store;
import org.springframework.content.rest.StoreRestResource;

@StoreRestResource(path="stream")
public interface FileStore extends Store<String> {
}
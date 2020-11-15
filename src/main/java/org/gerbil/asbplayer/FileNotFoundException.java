package org.gerbil.asbplayer;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(code = HttpStatus.NOT_FOUND, reason = "file not found")
public class FileNotFoundException extends RuntimeException {
}

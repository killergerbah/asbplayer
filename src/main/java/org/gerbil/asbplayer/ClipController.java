package org.gerbil.asbplayer;

import org.gerbil.asbplayer.model.ClipAudioRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = RequestMethod.POST)
@RequestMapping(path = "clip", consumes = "application/json", produces = "application/octet-stream")
public class ClipController {

    private final ClipService clipService;

    public ClipController(ClipService clipService) {
        this.clipService = clipService;
    }

    @PostMapping(path = "audio")
    public ResponseEntity<byte[]> audio(@RequestBody ClipAudioRequest request) throws Exception {
        return ResponseEntity
                .ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(clipService.clipAudio(request.getPath(), request.getStart(), request.getEnd(), request.getTrackId()));
    }
}

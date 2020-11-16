package org.gerbil.asbplayer;

import org.gerbil.asbplayer.model.SubtitleResponse;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequestMapping(path = "subtitle", produces = "application/json")
public class SubtitleController {

    private final SubtitleRepository subtitleRepository;

    public SubtitleController(SubtitleRepository subtitleRepository) {
        this.subtitleRepository = subtitleRepository;
    }

    @GetMapping(value = "{path}")
    public SubtitleResponse subtitles(@PathVariable("path") String path) {
        return new SubtitleResponse(subtitleRepository.getSubtitles(path));
    }
}

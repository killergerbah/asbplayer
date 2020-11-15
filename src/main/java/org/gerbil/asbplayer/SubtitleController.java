package org.gerbil.asbplayer;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("api/subtitle")
public class SubtitleController {

    private final SubtitleRepository subtitleRepository;

    public SubtitleController(SubtitleRepository subtitleRepository) {
        this.subtitleRepository = subtitleRepository;
    }

    @GetMapping(value = "{path}", produces = "application/json")
    public SubtitleResponse subtitles(@PathVariable("path") String path) {
        return new SubtitleResponse(subtitleRepository.getSubtitles(path));
    }
}

package org.gerbil.asbplayer;

import org.gerbil.asbplayer.model.SubtitleResponse;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@RestController
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequestMapping(path = "api/subtitle", produces = "application/json")
public class SubtitleController {

    private final SubtitleRepository subtitleRepository;

    public SubtitleController(SubtitleRepository subtitleRepository) {
        this.subtitleRepository = subtitleRepository;
    }

    @GetMapping(path = "**")
    public SubtitleResponse subtitles(HttpServletRequest request) {
        var path = URLDecoder.decode(request.getRequestURL().toString().split("/subtitle/")[1], StandardCharsets.UTF_8);
        return new SubtitleResponse(subtitleRepository.getSubtitles(path));
    }
}

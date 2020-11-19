package org.gerbil.asbplayer;

import org.gerbil.asbplayer.model.ListResponse;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@RestController
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequestMapping(path = "ls", produces = "application/json")
public class BrowserController {

    private final BrowserService browserService;

    public BrowserController(BrowserService browserService) {
        this.browserService = browserService;
    }

    @GetMapping
    public ListResponse list() {
        return new ListResponse(browserService.list(""));
    }

    @GetMapping(path = "**")
    public ListResponse subtitles(HttpServletRequest request) {
        var path = URLDecoder.decode(request.getRequestURL().toString().split("/ls/")[1], StandardCharsets.UTF_8);
        return new ListResponse(browserService.list(path));
    }
}

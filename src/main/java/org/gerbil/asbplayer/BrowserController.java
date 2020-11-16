package org.gerbil.asbplayer;

import org.gerbil.asbplayer.model.ListResponse;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

    @GetMapping(value = "{path}")
    public ListResponse list(@PathVariable("path") String path) {
        return new ListResponse(browserService.list(path));
    }
}

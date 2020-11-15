package org.gerbil.asbplayer;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequestMapping("api/ls")
public class BrowserController {

    private final BrowserService browserService;

    public BrowserController(BrowserService browserService) {
        this.browserService = browserService;
    }

    @GetMapping(produces = "application/json")
    public List<String> list() {
        return browserService.list("");
    }

    @GetMapping(value = "{path}", produces = "application/json")
    public List<String> list(@PathVariable("path") String path) {
        return browserService.list(path);
    }
}

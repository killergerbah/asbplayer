package org.gerbil.asbplayer;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class HomeController {

    @GetMapping(value = {"/"})
    public String index() {
        return "index.html";
    }

    @GetMapping(value = {"/browse/**"})
    public String browse() {
        return "/";
    }

    @GetMapping(value = {"/view"})
    public String view() {
        return "/";
    }

    @GetMapping(value = {"/video"})
    public String video() {
        return "/";
    }
}

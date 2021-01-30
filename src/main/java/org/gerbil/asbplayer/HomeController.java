package org.gerbil.asbplayer;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class HomeController {

    @RequestMapping(value = {"/"})
    public String index() {
        return "index.html";
    }

    @RequestMapping(value = {"/browse"})
    public String browseRoot() {
        return "/";
    }

    @RequestMapping(value = {"/browse/{**}"})
    public String browse() {
        return "/";
    }

    @RequestMapping(value = {"/view"})
    public String view() {
        return "/";
    }

    @RequestMapping(value = {"/video"})
    public String video() {
        return "/";
    }
}

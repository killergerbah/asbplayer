package org.gerbil.asbplayer;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.content.fs.config.EnableFilesystemStores;
import org.springframework.content.fs.io.FileSystemResourceLoader;
import org.springframework.context.annotation.Bean;

import java.io.File;

@SpringBootApplication
@EnableFilesystemStores
public class AsbplayerApplication {

    @Value("${root:#{null}}")
    private String root;

    public static void main(String[] args) {
        SpringApplication.run(AsbplayerApplication.class, args);
    }

    @Bean
    @Qualifier("root")
    public File filesystemRoot() {
        if (root == null) {
            root = System.getProperty("user.home");
        }

        return new File(root);
    }

    @Bean
    public FileSystemResourceLoader fileSystemResourceLoader(@Qualifier("root") File fileSystemRoot) {
        return new FileSystemResourceLoader(fileSystemRoot.getAbsolutePath());
    }
}
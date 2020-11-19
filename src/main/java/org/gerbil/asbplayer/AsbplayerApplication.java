package org.gerbil.asbplayer;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.content.fs.config.EnableFilesystemStores;
import org.springframework.content.fs.io.FileSystemResourceLoader;
import org.springframework.context.annotation.Bean;

import java.io.File;

@SpringBootApplication
@EnableFilesystemStores
public class AsbplayerApplication {

	public static void main(String[] args) {
		SpringApplication.run(AsbplayerApplication.class, args);
	}

	@Bean
	@Qualifier("root")
	public File filesystemRoot() {
		return new File("E:\\");
	}

	@Bean
	public FileSystemResourceLoader fileSystemResourceLoader(@Qualifier("root") File fileSystemRoot) {
		return new FileSystemResourceLoader(fileSystemRoot.getAbsolutePath());
	}
}
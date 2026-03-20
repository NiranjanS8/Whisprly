package com.chatapp;

import com.chatapp.config.DotenvLoader;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.nio.file.Path;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class ChatAppApplication {

    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(ChatAppApplication.class);
        application.setDefaultProperties(DotenvLoader.loadDefaults(Path.of(".env")));
        application.run(args);
    }
}

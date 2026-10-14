package com.portfoliolab.backend.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class NotificationJacksonConfig {

    @Bean
    public ObjectMapper notificationObjectMapper() {
        return new ObjectMapper();
    }
}

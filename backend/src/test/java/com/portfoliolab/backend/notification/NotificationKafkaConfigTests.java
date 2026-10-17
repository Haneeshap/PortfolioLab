package com.portfoliolab.backend.notification;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class NotificationKafkaConfigTests {
    @Test
    void explicitBrokerGroupAndListenerSettingsAreHonoredWithoutOpeningConnections() {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("isolated", Map.of(
                    "spring.kafka.bootstrap-servers", "127.0.0.1:19092",
                    "spring.kafka.consumer.group-id", "isolated-verification",
                    "spring.kafka.consumer.auto-offset-reset", "latest",
                    "spring.kafka.listener.auto-startup", "false")));
            context.register(NotificationKafkaConfig.class);
            context.refresh();
            var producer = context.getBean(DefaultKafkaProducerFactory.class).getConfigurationProperties();
            var consumer = context.getBean(DefaultKafkaConsumerFactory.class).getConfigurationProperties();
            assertEquals("127.0.0.1:19092", producer.get("bootstrap.servers"));
            assertEquals("127.0.0.1:19092", consumer.get("bootstrap.servers"));
            assertEquals("isolated-verification", consumer.get("group.id"));
            assertEquals("latest", consumer.get("auto.offset.reset"));
            var listener = context.getBean(ConcurrentKafkaListenerContainerFactory.class).createContainer("not-started");
            assertFalse(listener.isAutoStartup());
        }
    }
}

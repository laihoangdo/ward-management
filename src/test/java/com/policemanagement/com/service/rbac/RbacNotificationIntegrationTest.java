package com.policemanagement.com.service.rbac;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.io.IOException;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.datasource.*;
import org.springframework.test.util.AopTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class RbacNotificationIntegrationTest {

    static class Sink {

        final List<Map<?, ?>> changes = new ArrayList<>();
    }

    @Configuration
    @EnableAspectJAutoProxy
    @EnableTransactionManagement
    static class Config {

        @Bean
        Sink sink() {
            return new Sink();
        }

        @Bean
        RbacEventHub events(Sink sink) {
            return new RbacEventHub(
                () ->
                    new SseEmitter() {
                        @Override
                        public void send(SseEventBuilder event) throws IOException {
                            event
                                .build()
                                .stream()
                                .map(item -> item.getData())
                                .filter(Map.class::isInstance)
                                .map(Map.class::cast)
                                .filter(data -> data.containsKey("topics"))
                                .forEach(sink.changes::add);
                        }
                    },
                Runnable::run
            );
        }

        @Bean
        RbacChangeAspect changes(RbacEventHub hub) {
            return new RbacChangeAspect(hub);
        }

        @Bean
        RbacService rbac() {
            return mock(RbacService.class);
        }

        @Bean
        RbacFailureAudit failureAudit() {
            return mock(RbacFailureAudit.class);
        }

        @Bean
        PlatformTransactionManager transactionManager() {
            return new DataSourceTransactionManager(new DriverManagerDataSource("jdbc:h2:mem:rbacevents" + UUID.randomUUID(), "sa", ""));
        }
    }

    @Test
    void realSpringProxyAndTransactionsDeliverAfterCommitButSuppressRollback() throws Exception {
        try (var context = new AnnotationConfigApplicationContext(Config.class)) {
            var service = context.getBean(RbacService.class);
            RbacService target = AopTestUtils.getUltimateTargetObject(service);
            when(target.saveProfile(eq("target"), anyMap())).thenReturn(Map.of("id", "target", "version", 9L));
            var sink = context.getBean(Sink.class);
            context.getBean(RbacEventHub.class).open("target");
            var tx = new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
            tx.execute(status -> {
                service.saveProfile("target", Map.of());
                assertTrue(sink.changes.isEmpty());
                status.setRollbackOnly();
                return null;
            });
            assertTrue(sink.changes.isEmpty());
            tx.execute(status -> {
                service.saveProfile("target", Map.of());
                assertTrue(sink.changes.isEmpty());
                return null;
            });
            assertEquals(1, sink.changes.size());
            assertEquals(9L, sink.changes.getFirst().get("version"));
        }
    }
}

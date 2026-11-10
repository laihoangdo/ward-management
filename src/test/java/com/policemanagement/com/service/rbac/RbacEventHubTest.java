package com.policemanagement.com.service.rbac;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class RbacEventHubTest {

    static class Emitter extends SseEmitter {

        final List<Map<?, ?>> messages = new ArrayList<>();
        Runnable completed;
        boolean fail;

        @Override
        public synchronized void onCompletion(Runnable callback) {
            completed = callback;
        }

        @Override
        public void send(SseEventBuilder event) throws IOException {
            if (fail) throw new IOException("disconnected");
            event
                .build()
                .stream()
                .map(item -> item.getData())
                .filter(Map.class::isInstance)
                .map(Map.class::cast)
                .filter(data -> data.containsKey("topics"))
                .forEach(messages::add);
        }
    }

    private List<Emitter> streams;
    private RbacEventHub hub;

    @BeforeEach
    void setup() {
        streams = new ArrayList<>();
        hub = new RbacEventHub(() -> {
            var emitter = new Emitter();
            streams.add(emitter);
            return emitter;
        }, Runnable::run);
    }

    @AfterEach
    void cleanup() {
        hub.close();
    }

    @Test
    void sendsRightsOnlyToTheirSubjectAndNeverExposesAnotherSubjectOrVersion() throws Exception {
        hub.open("target");
        hub.open("other");
        hub.publish(new RbacEventHub.Change("target", Set.of("me", "users"), 5L, false));
        assertEquals(Set.of("me", "users"), streams.get(0).messages.getFirst().get("topics"));
        assertEquals(5L, streams.get(0).messages.getFirst().get("version"));
        assertEquals(Set.of("users"), streams.get(1).messages.getFirst().get("topics"));
        assertFalse(streams.get(1).messages.getFirst().containsKey("version"));
        assertFalse(streams.get(0).messages.getFirst().containsKey("subject"));
    }

    @Test
    void publishesOnlyAfterCommitAndNeverForRollback() throws Exception {
        hub.open("target");
        var manager = new DataSourceTransactionManager(new DriverManagerDataSource("jdbc:h2:mem:events" + UUID.randomUUID(), "sa", ""));
        var transaction = new TransactionTemplate(manager);
        var change = new RbacEventHub.Change("target", Set.of("me"), 1L, false);
        transaction.execute(status -> {
            hub.afterCommit(change);
            assertTrue(streams.getFirst().messages.isEmpty());
            status.setRollbackOnly();
            return null;
        });
        assertTrue(streams.getFirst().messages.isEmpty());
        transaction.execute(status -> {
            hub.afterCommit(change);
            assertTrue(streams.getFirst().messages.isEmpty());
            return null;
        });
        assertEquals(1, streams.getFirst().messages.size());
    }

    @Test
    void removesCompletedAndFailedConnectionsAndDoesNotTurnHeartbeatsIntoInvalidations() throws Exception {
        hub.open("one");
        hub.open("two");
        hub.heartbeat();
        assertTrue(streams.stream().allMatch(s -> s.messages.isEmpty()));
        streams.get(0).completed.run();
        streams.get(1).fail = true;
        hub.heartbeat();
        assertEquals(0, hub.connectionCount());
    }

    @Test
    void coalescesQueuedSignalsWithoutLosingGlobalInvalidation() throws Exception {
        var tasks = new ArrayDeque<Runnable>();
        hub.close();
        hub = new RbacEventHub(() -> {
            var e = new Emitter();
            streams.add(e);
            return e;
        }, tasks::add);
        hub.open("one");
        hub.heartbeat();
        hub.publish(new RbacEventHub.Change(null, Set.of("me", "menus"), null, true));
        hub.publish(new RbacEventHub.Change("one", Set.of("me"), 7L, false));
        assertEquals(1, tasks.size());
        tasks.remove().run();
        assertEquals(1, streams.getFirst().messages.size());
        assertEquals(true, streams.getFirst().messages.getFirst().get("force"));
        assertEquals(7L, streams.getFirst().messages.getFirst().get("version"));
    }
}

package com.policemanagement.com.service.rbac;

import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.Supplier;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Invalidation signals only. A client always re-reads data through authorized REST endpoints. */
@Component
public class RbacEventHub {

    public record Change(String subject, Set<String> topics, Long version, boolean force) {
        public Change {
            topics = Set.copyOf(topics);
        }
    }

    private record Pending(Set<String> topics, Long version, boolean force, long revision, long accessRevision) {
        Pending merge(Pending other) {
            var merged = new HashSet<>(topics);
            merged.addAll(other.topics);
            Long newest = version;
            if (newest == null || (other.version != null && other.version > newest)) newest = other.version;
            return new Pending(
                Set.copyOf(merged),
                newest,
                force || other.force,
                Math.max(revision, other.revision),
                Math.max(accessRevision, other.accessRevision)
            );
        }

        Map<String, Object> payload(String instance) {
            var data = new HashMap<String, Object>();
            data.put("topics", topics);
            data.put("force", force);
            data.put("revision", instance + ":" + revision);
            data.put("accessRevision", instance + ":" + accessRevision);
            if (version != null) data.put("version", version);
            return data;
        }
    }

    private static final class Connection {

        final String subject;
        final SseEmitter emitter;
        final AtomicBoolean writing = new AtomicBoolean();
        final AtomicReference<Pending> pending = new AtomicReference<>();

        Connection(String subject, SseEmitter emitter) {
            this.subject = subject;
            this.emitter = emitter;
        }
    }

    private final ConcurrentMap<SseEmitter, Connection> connections = new ConcurrentHashMap<>();
    private final Supplier<SseEmitter> factory;
    private final Executor executor;
    private final String instance = UUID.randomUUID().toString();
    private final AtomicLong revision = new AtomicLong();
    private final AtomicLong accessRevision = new AtomicLong();

    public RbacEventHub() {
        this(() -> new SseEmitter(30 * 60 * 1000L), Executors.newVirtualThreadPerTaskExecutor());
    }

    RbacEventHub(Supplier<SseEmitter> factory, Executor executor) {
        this.factory = factory;
        this.executor = executor;
    }

    public synchronized SseEmitter open(String subject) throws IOException {
        if (
            connections
                .values()
                .stream()
                .filter(c -> c.subject.equals(subject))
                .count() >= 16 ||
            connections.size() >= 4096
        ) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Quá nhiều kết nối thông báo");
        var emitter = factory.get();
        var connection = new Connection(subject, emitter);
        connections.put(emitter, connection);
        emitter.onCompletion(() -> connections.remove(emitter));
        emitter.onTimeout(() -> {
            connections.remove(emitter);
            emitter.complete();
        });
        emitter.onError(error -> connections.remove(emitter));
        try {
            emitter.send(
                SseEmitter.event()
                    .name("ready")
                    .reconnectTime(5000)
                    .data(
                        Map.of(
                            "connected",
                            true,
                            "revision",
                            instance + ":" + revision.get(),
                            "accessRevision",
                            instance + ":" + accessRevision.get()
                        )
                    )
            );
        } catch (IOException | RuntimeException error) {
            connections.remove(emitter);
            throw error;
        }
        return emitter;
    }

    public void afterCommit(Change change) {
        if (TransactionSynchronizationManager.isActualTransactionActive() && TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        publish(change);
                    }
                }
            );
        } else publish(change);
    }

    public synchronized void publish(Change change) {
        long next = revision.incrementAndGet();
        if (change.topics().contains("me")) accessRevision.incrementAndGet();
        for (var connection : connections.values()) {
            var topics = new HashSet<>(change.topics());
            if (change.subject() != null && !change.subject().equals(connection.subject)) topics.remove("me");
            if (topics.isEmpty()) continue;
            enqueue(
                connection,
                new Pending(Set.copyOf(topics), topics.contains("me") ? change.version() : null, change.force(), next, accessRevision.get())
            );
        }
    }

    @Scheduled(fixedDelay = 20000)
    public void heartbeat() {
        connections.values().forEach(c -> enqueue(c, new Pending(Set.of(), null, false, revision.get(), accessRevision.get())));
    }

    private void enqueue(Connection connection, Pending notice) {
        connection.pending.accumulateAndGet(notice, (old, next) -> old == null ? next : old.merge(next));
        flush(connection);
    }

    private void flush(Connection connection) {
        if (!connections.containsKey(connection.emitter) || !connection.writing.compareAndSet(false, true)) return;
        try {
            executor.execute(() -> {
                try {
                    Pending next;
                    while (connections.containsKey(connection.emitter) && (next = connection.pending.getAndSet(null)) != null)
                        connection.emitter.send(
                            next.topics().isEmpty()
                                ? SseEmitter.event().name("ping").data(Map.of())
                                : SseEmitter.event().name("change").data(next.payload(instance))
                        );
                } catch (IOException | RuntimeException error) {
                    // The servlet container completes a failed write; remove it from future broadcasts.
                    connections.remove(connection.emitter);
                } finally {
                    connection.writing.set(false);
                    if (connection.pending.get() != null && connections.containsKey(connection.emitter)) flush(connection);
                }
            });
        } catch (RejectedExecutionException error) {
            connection.writing.set(false);
            connections.remove(connection.emitter);
        }
    }

    int connectionCount() {
        return connections.size();
    }

    @PreDestroy
    public void close() {
        var old = List.copyOf(connections.keySet());
        connections.clear();
        old.forEach(SseEmitter::complete);
        if (executor instanceof ExecutorService service) service.shutdownNow();
    }
}

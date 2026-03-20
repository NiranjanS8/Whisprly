package com.chatapp.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
@ConditionalOnProperty(name = "app.presence.store", havingValue = "memory", matchIfMissing = true)
public class InMemoryPresenceStore implements PresenceStore {

    private final Map<String, UUID> sessionToUser = new ConcurrentHashMap<>();
    private final Map<UUID, Integer> onlineCounts = new ConcurrentHashMap<>();

    @Override
    public void registerSession(String sessionId, UUID userId) {
        UUID previous = sessionToUser.put(sessionId, userId);
        if (previous != null && !previous.equals(userId)) {
            onlineCounts.computeIfPresent(previous, (key, value) -> value > 1 ? value - 1 : null);
        }
        onlineCounts.merge(userId, 1, Integer::sum);
    }

    @Override
    public void refreshSession(String sessionId) {
        // No-op for the in-memory store.
    }

    @Override
    public void unregisterSession(String sessionId) {
        UUID userId = sessionToUser.remove(sessionId);
        if (userId == null) {
            return;
        }
        onlineCounts.computeIfPresent(userId, (key, value) -> value > 1 ? value - 1 : null);
    }

    @Override
    public boolean isOnline(UUID userId) {
        return userId != null && onlineCounts.containsKey(userId);
    }

    @Override
    public Set<UUID> getOnlineUserIds() {
        return Set.copyOf(onlineCounts.keySet());
    }
}

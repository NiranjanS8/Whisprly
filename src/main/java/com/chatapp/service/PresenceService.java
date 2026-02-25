package com.chatapp.service;

import org.springframework.context.event.EventListener;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PresenceService {

    private final Map<String, UUID> sessionToUser = new ConcurrentHashMap<>();
    private final Map<UUID, Integer> onlineCounts = new ConcurrentHashMap<>();

    @EventListener
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public void onSessionConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        Object userIdObj = accessor.getSessionAttributes() == null
                ? null
                : accessor.getSessionAttributes().get("userId");

        if (sessionId == null || !(userIdObj instanceof UUID userId)) {
            return;
        }

        UUID previous = sessionToUser.put(sessionId, userId);
        if (previous != null && !previous.equals(userId)) {
            onlineCounts.computeIfPresent(previous, (key, value) -> value > 1 ? value - 1 : null);
        }
        onlineCounts.merge(userId, 1, Integer::sum);
    }

    @EventListener
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public void onSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        if (sessionId == null) {
            return;
        }

        UUID userId = sessionToUser.remove(sessionId);
        if (userId == null) {
            return;
        }
        onlineCounts.computeIfPresent(userId, (key, value) -> value > 1 ? value - 1 : null);
    }

    public boolean isOnline(UUID userId) {
        if (userId == null) {
            return false;
        }
        return onlineCounts.containsKey(userId);
    }

    public Set<UUID> getOnlineUserIds() {
        return Set.copyOf(onlineCounts.keySet());
    }
}

package com.chatapp.service;

import com.chatapp.observability.AppMetrics;
import org.springframework.context.event.EventListener;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Set;
import java.util.UUID;

@Service
public class PresenceService {

    private final PresenceStore presenceStore;
    private final AppMetrics appMetrics;

    public PresenceService(PresenceStore presenceStore, AppMetrics appMetrics) {
        this.presenceStore = presenceStore;
        this.appMetrics = appMetrics;
    }

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

        presenceStore.registerSession(sessionId, userId);
        appMetrics.recordPresenceConnect();
    }

    @EventListener
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public void onSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        if (sessionId == null) {
            return;
        }

        presenceStore.unregisterSession(sessionId);
        appMetrics.recordPresenceDisconnect();
    }

    public void refreshSession(String sessionId) {
        presenceStore.refreshSession(sessionId);
    }

    public boolean isOnline(UUID userId) {
        return presenceStore.isOnline(userId);
    }

    public Set<UUID> getOnlineUserIds() {
        return presenceStore.getOnlineUserIds();
    }
}

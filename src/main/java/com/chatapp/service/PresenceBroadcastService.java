package com.chatapp.service;

import com.chatapp.dto.PresenceSnapshotResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class PresenceBroadcastService {

    private final PresenceService presenceService;
    private final SimpMessagingTemplate messagingTemplate;

    @EventListener
    @Order(Ordered.LOWEST_PRECEDENCE)
    public void onSessionConnected(SessionConnectEvent event) {
        broadcastSnapshot();
    }

    @EventListener
    @Order(Ordered.LOWEST_PRECEDENCE)
    public void onSessionDisconnected(SessionDisconnectEvent event) {
        broadcastSnapshot();
    }

    private void broadcastSnapshot() {
        PresenceSnapshotResponse response = PresenceSnapshotResponse.builder()
                .onlineUserIds(presenceService.getOnlineUserIds())
                .timestamp(Instant.now())
                .build();
        messagingTemplate.convertAndSend("/topic/presence/snapshot", response);
    }
}

package com.chatapp.controller;

import com.chatapp.dto.PresenceSnapshotResponse;
import com.chatapp.service.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.time.Instant;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
public class PresenceController {

    private final PresenceService presenceService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/presence/snapshot")
    public void sendPresenceSnapshot(SimpMessageHeaderAccessor headerAccessor) {
        Object userIdObj = headerAccessor.getSessionAttributes() == null
                ? null
                : headerAccessor.getSessionAttributes().get("userId");
        if (!(userIdObj instanceof UUID userId)) {
            return;
        }

        PresenceSnapshotResponse response = PresenceSnapshotResponse.builder()
                .onlineUserIds(presenceService.getOnlineUserIds())
                .timestamp(Instant.now())
                .build();

        messagingTemplate.convertAndSendToUser(userId.toString(), "/queue/presence", response);
    }
}

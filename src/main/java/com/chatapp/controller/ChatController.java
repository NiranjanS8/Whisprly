package com.chatapp.controller;

import com.chatapp.dto.ChatMessageRequest;
import com.chatapp.dto.ChatMessageResponse;
import com.chatapp.dto.TypingEventRequest;
import com.chatapp.dto.TypingEventResponse;
import com.chatapp.repository.ChatRoomMemberRepository;
import com.chatapp.service.MessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.util.Map;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ChatRoomMemberRepository memberRepository;

    @MessageMapping("/chat/{roomId}")
    public void handleMessage(
            @DestinationVariable UUID roomId,
            ChatMessageRequest request,
            SimpMessageHeaderAccessor headerAccessor) {

        UUID senderId = (UUID) headerAccessor.getSessionAttributes().get("userId");

        if (senderId == null) {
            log.warn("WebSocket message from unauthenticated session");
            return;
        }

        // Service method is @Transactional — commits on return.
        // Broadcast happens AFTER commit to prevent ghost messages.
        ChatMessageResponse response = messageService.sendMessage(
                roomId, senderId, request.getContent(), request.getIdempotencyKey());

        // Transaction committed — safe to broadcast
        messagingTemplate.convertAndSend("/topic/room/" + roomId, response);
    }

    @MessageMapping("/typing/{roomId}")
    public void handleTyping(
            @DestinationVariable UUID roomId,
            TypingEventRequest request,
            SimpMessageHeaderAccessor headerAccessor) {
        UUID senderId = (UUID) headerAccessor.getSessionAttributes().get("userId");
        String username = (String) headerAccessor.getSessionAttributes().get("username");

        if (senderId == null || username == null) {
            log.warn("WebSocket typing event from unauthenticated session");
            return;
        }

        if (!memberRepository.existsByRoomIdAndUserId(roomId, senderId)) {
            log.warn("Typing event denied: user {} is not a member of room {}", senderId, roomId);
            return;
        }

        TypingEventResponse response = TypingEventResponse.builder()
                .roomId(roomId)
                .userId(senderId)
                .username(username)
                .typing(request != null && request.isTyping())
                .build();

        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/typing", response);
    }

    @MessageExceptionHandler
    @SendToUser("/queue/errors")
    public Map<String, String> handleException(Exception ex) {
        log.warn("WebSocket message error: {}", ex.getMessage());
        return Map.of(
                "code", "MESSAGE_ERROR",
                "message", "Failed to process message");
    }
}

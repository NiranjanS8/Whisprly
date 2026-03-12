package com.chatapp.controller;

import com.chatapp.dto.ChatMessageRequest;
import com.chatapp.dto.ChatMessageResponse;
import com.chatapp.dto.RoomUnreadUpdateResponse;
import com.chatapp.dto.TypingEventRequest;
import com.chatapp.dto.TypingEventResponse;
import com.chatapp.model.ChatRoom;
import com.chatapp.repository.ChatRoomMemberRepository;
import com.chatapp.service.ChatRoomService;
import com.chatapp.service.MessageService;
import com.chatapp.service.RoomPublicIdService;
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
    private final ChatRoomService chatRoomService;
    private final RoomPublicIdService roomPublicIdService;

    @MessageMapping("/chat/{roomKey}")
    public void handleMessage(
            @DestinationVariable String roomKey,
            ChatMessageRequest request,
            SimpMessageHeaderAccessor headerAccessor) {

        UUID senderId = (UUID) headerAccessor.getSessionAttributes().get("userId");

        if (senderId == null) {
            log.warn("WebSocket message from unauthenticated session");
            return;
        }

        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);

        ChatMessageResponse response = messageService.sendMessage(
                room.getId(), senderId, request.getContent(), request.getIdempotencyKey());

        messagingTemplate.convertAndSend("/topic/room/" + room.getSlug(), response);

        for (RoomUnreadUpdateResponse unreadUpdate : chatRoomService.getUnreadUpdatesForRoom(room.getId())) {
            if (unreadUpdate.getUserId() == null) {
                continue;
            }
            messagingTemplate.convertAndSendToUser(
                    unreadUpdate.getUserId().toString(),
                    "/queue/rooms/unread",
                    unreadUpdate);
        }
    }

    @MessageMapping("/typing/{roomKey}")
    public void handleTyping(
            @DestinationVariable String roomKey,
            TypingEventRequest request,
            SimpMessageHeaderAccessor headerAccessor) {
        UUID senderId = (UUID) headerAccessor.getSessionAttributes().get("userId");
        String username = (String) headerAccessor.getSessionAttributes().get("username");

        if (senderId == null || username == null) {
            log.warn("WebSocket typing event from unauthenticated session");
            return;
        }

        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        if (!memberRepository.existsByRoomIdAndUserId(room.getId(), senderId)) {
            log.warn("Typing event denied: user {} is not a member of room {}", senderId, room.getId());
            return;
        }

        TypingEventResponse response = TypingEventResponse.builder()
                .roomId(room.getId())
                .roomSlug(room.getSlug())
                .userId(senderId)
                .username(username)
                .typing(request != null && request.isTyping())
                .build();

        messagingTemplate.convertAndSend("/topic/room/" + room.getSlug() + "/typing", response);
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

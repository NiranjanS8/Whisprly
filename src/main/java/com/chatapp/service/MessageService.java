package com.chatapp.service;

import com.chatapp.dto.ChatMessageResponse;
import com.chatapp.exception.ResourceNotFoundException;
import com.chatapp.model.ChatRoom;
import com.chatapp.model.Message;
import com.chatapp.model.User;
import com.chatapp.repository.ChatRoomMemberRepository;
import com.chatapp.repository.ChatRoomRepository;
import com.chatapp.repository.MessageRepository;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessageService {

    private final MessageRepository messageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomMemberRepository memberRepository;
    private final UserRepository userRepository;

    @Transactional
    public ChatMessageResponse sendMessage(UUID roomId, UUID senderId, String content, UUID idempotencyKey) {
        // Idempotency check: if a message with this key already exists, return it
        if (idempotencyKey != null) {
            Optional<Message> existing = messageRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                log.debug("Duplicate message detected: idempotencyKey={}", idempotencyKey);
                return toResponse(existing.get());
            }
        }

        // Verify room exists
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", "id", roomId));

        // Verify sender is a member
        if (!memberRepository.existsByRoomIdAndUserId(roomId, senderId)) {
            throw new AccessDeniedException("You are not a member of this room");
        }

        // Load sender
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", senderId));

        // Persist message
        Message message = Message.builder()
                .room(room)
                .sender(sender)
                .content(content)
                .idempotencyKey(idempotencyKey)
                .build();

        message = messageRepository.save(message);

        log.info("Message sent: roomId={}, senderId={}", roomId, senderId);

        return toResponse(message);
    }

    @Transactional(readOnly = true)
    public Page<ChatMessageResponse> getMessageHistory(UUID roomId, UUID userId, int page, int size) {
        // Verify membership
        if (!memberRepository.existsByRoomIdAndUserId(roomId, userId)) {
            throw new AccessDeniedException("You are not a member of this room");
        }

        return messageRepository.findByRoomIdWithSender(roomId, PageRequest.of(page, size))
                .map(this::toResponse);
    }

    private ChatMessageResponse toResponse(Message message) {
        return ChatMessageResponse.builder()
                .id(message.getId())
                .roomId(message.getRoom().getId())
                .senderId(message.getSender().getId())
                .senderUsername(message.getSender().getUsername())
                .content(message.getContent())
                .createdAt(message.getCreatedAt())
                .build();
    }
}

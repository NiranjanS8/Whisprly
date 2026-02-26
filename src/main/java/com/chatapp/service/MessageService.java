package com.chatapp.service;

import com.chatapp.dto.ChatMessageResponse;
import com.chatapp.dto.AttachmentResponse;
import com.chatapp.exception.ResourceNotFoundException;
import com.chatapp.model.AttachmentCategory;
import com.chatapp.model.ChatRoom;
import com.chatapp.model.ChatRoomMember;
import com.chatapp.model.MemberRole;
import com.chatapp.model.Message;
import com.chatapp.model.User;
import com.chatapp.repository.ChatRoomMemberRepository;
import com.chatapp.repository.ChatRoomRepository;
import com.chatapp.repository.MessageRepository;
import com.chatapp.repository.UserRepository;
import com.chatapp.storage.AttachmentValidationService;
import com.chatapp.storage.StorageService;
import com.chatapp.storage.ValidatedAttachment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessageService {

    private static final String DELETED_PLACEHOLDER = "This message was removed.";

    private final MessageRepository messageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final AttachmentValidationService attachmentValidationService;

    @Transactional
    public ChatMessageResponse sendMessage(UUID roomId, UUID senderId, String content, UUID idempotencyKey) {
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("Message content is required");
        }

        // Idempotency check: if a message with this key already exists, return it
        if (idempotencyKey != null) {
            Optional<Message> existing = messageRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                log.debug("Duplicate message detected: idempotencyKey={}", idempotencyKey);
                return toResponse(existing.get());
            }
        }

        ChatRoom room = validateSenderCanMessage(roomId, senderId);

        // Load sender
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", senderId));

        // Persist message
        Message message = Message.builder()
                .room(room)
                .sender(sender)
                .content(content.trim())
                .idempotencyKey(idempotencyKey)
                .build();

        message = messageRepository.save(message);

        log.info("Message sent: roomId={}, senderId={}", roomId, senderId);

        return toResponse(message);
    }

    @Transactional
    public ChatMessageResponse sendAttachmentMessage(
            UUID roomId,
            UUID senderId,
            String content,
            MultipartFile attachmentFile,
            UUID idempotencyKey
    ) {
        if (idempotencyKey != null) {
            Optional<Message> existing = messageRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                return toResponse(existing.get());
            }
        }

        ChatRoom room = validateSenderCanMessage(roomId, senderId);
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", senderId));

        ValidatedAttachment validatedAttachment = attachmentValidationService.validate(attachmentFile);
        String storageKey = storageService.store(attachmentFile);

        Message message = Message.builder()
                .room(room)
                .sender(sender)
                .content(content == null ? "" : content.trim())
                .idempotencyKey(idempotencyKey)
                .attachmentOriginalName(validatedAttachment.fileName())
                .attachmentContentType(validatedAttachment.contentType())
                .attachmentSizeBytes(validatedAttachment.sizeBytes())
                .attachmentCategory(validatedAttachment.category())
                .attachmentStorageKey(storageKey)
                .build();

        message = messageRepository.save(message);
        message.setAttachmentUrl(buildAttachmentUrl(roomId, message.getId()));
        message = messageRepository.save(message);

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

    @Transactional
    public ChatMessageResponse editMessage(UUID roomId, UUID messageId, UUID userId, String content) {
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("Message content is required");
        }

        Message message = messageRepository.findByIdAndRoomIdWithSender(messageId, roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", "id", messageId));

        if (!message.getSender().getId().equals(userId)) {
            throw new AccessDeniedException("You can only edit your own messages");
        }

        if (message.getDeletedAt() != null) {
            throw new IllegalStateException("Deleted messages cannot be edited");
        }

        String trimmedContent = content.trim();
        if (!trimmedContent.equals(message.getContent())) {
            message.setContent(trimmedContent);
            message.setEditedAt(Instant.now());
            message = messageRepository.save(message);
        }

        return toResponse(message);
    }

    @Transactional
    public ChatMessageResponse deleteMessage(UUID roomId, UUID messageId, UUID userId) {
        Message message = messageRepository.findByIdAndRoomIdWithSender(messageId, roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", "id", messageId));

        if (!message.getSender().getId().equals(userId)) {
            throw new AccessDeniedException("You can only delete your own messages");
        }

        if (message.getDeletedAt() != null) {
            return toResponse(message);
        }

        message.setContent(DELETED_PLACEHOLDER);
        message.setDeletedAt(Instant.now());
        message.setEditedAt(null);
        message.setAttachmentOriginalName(null);
        message.setAttachmentContentType(null);
        message.setAttachmentSizeBytes(null);
        message.setAttachmentCategory(null);
        message.setAttachmentStorageKey(null);
        message.setAttachmentUrl(null);

        message = messageRepository.save(message);
        return toResponse(message);
    }

    @Transactional(readOnly = true)
    public AttachmentDownload getAttachment(UUID roomId, UUID messageId, UUID userId) {
        if (!memberRepository.existsByRoomIdAndUserId(roomId, userId)) {
            throw new AccessDeniedException("You are not a member of this room");
        }

        Message message = messageRepository.findByIdAndRoomIdWithSender(messageId, roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", "id", messageId));

        if (message.getAttachmentStorageKey() == null || message.getAttachmentStorageKey().isBlank()) {
            throw new ResourceNotFoundException("Attachment", "messageId", messageId);
        }

        Resource resource = storageService.loadAsResource(message.getAttachmentStorageKey());
        return new AttachmentDownload(
                resource,
                message.getAttachmentOriginalName(),
                message.getAttachmentContentType(),
                message.getAttachmentCategory()
        );
    }

    private ChatRoom validateSenderCanMessage(UUID roomId, UUID senderId) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", "id", roomId));

        ChatRoomMember senderMembership = memberRepository.findByRoomIdAndUserId(roomId, senderId)
                .orElseThrow(() -> new AccessDeniedException("You are not a member of this room"));

        if (!Boolean.TRUE.equals(room.getMembersCanMessage())
                && senderMembership.getRole() == MemberRole.MEMBER) {
            throw new AccessDeniedException("Only moderators can send messages in this room");
        }
        return room;
    }

    private String buildAttachmentUrl(UUID roomId, UUID messageId) {
        return "/rooms/" + roomId + "/messages/" + messageId + "/attachment";
    }

    private ChatMessageResponse toResponse(Message message) {
        AttachmentResponse attachment = null;
        if (message.getDeletedAt() == null
                && message.getAttachmentStorageKey() != null
                && !message.getAttachmentStorageKey().isBlank()) {
            boolean inlinePreviewable = message.getAttachmentCategory() == AttachmentCategory.IMAGE
                    || message.getAttachmentCategory() == AttachmentCategory.VIDEO
                    || message.getAttachmentCategory() == AttachmentCategory.AUDIO;

            attachment = AttachmentResponse.builder()
                    .fileName(message.getAttachmentOriginalName())
                    .contentType(message.getAttachmentContentType())
                    .fileSizeBytes(message.getAttachmentSizeBytes())
                    .category(message.getAttachmentCategory() == null ? null : message.getAttachmentCategory().name())
                    .url(message.getAttachmentUrl() == null || message.getAttachmentUrl().isBlank()
                            ? buildAttachmentUrl(message.getRoom().getId(), message.getId())
                            : message.getAttachmentUrl())
                    .inlinePreviewable(inlinePreviewable)
                    .build();
        }

        return ChatMessageResponse.builder()
                .id(message.getId())
                .idempotencyKey(message.getIdempotencyKey())
                .roomId(message.getRoom().getId())
                .senderId(message.getSender().getId())
                .senderUsername(message.getSender().getUsername())
                .senderFullName(message.getSender().getFullName())
                .content(message.getContent())
                .attachment(attachment)
                .createdAt(message.getCreatedAt())
                .editedAt(message.getEditedAt())
                .deletedAt(message.getDeletedAt())
                .build();
    }

    public record AttachmentDownload(
            Resource resource,
            String fileName,
            String contentType,
            AttachmentCategory category
    ) {
    }
}

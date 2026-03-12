package com.chatapp.controller;

import com.chatapp.dto.ChatMessageResponse;
import com.chatapp.dto.MessageEditRequest;
import com.chatapp.dto.MessageSearchResultResponse;
import com.chatapp.model.AttachmentCategory;
import com.chatapp.model.ChatRoom;
import com.chatapp.model.User;
import com.chatapp.service.MessageService;
import com.chatapp.service.RoomPublicIdService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;
    private final RoomPublicIdService roomPublicIdService;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping("/{roomKey}/messages")
    public ResponseEntity<Page<ChatMessageResponse>> getMessages(
            @PathVariable String roomKey,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        Page<ChatMessageResponse> messages = messageService.getMessageHistory(room.getId(), currentUser.getId(), page, size);
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/{roomKey}/messages/{messageId}")
    public ResponseEntity<ChatMessageResponse> getMessage(
            @PathVariable String roomKey,
            @PathVariable UUID messageId,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        ChatMessageResponse message = messageService.getMessage(room.getId(), messageId, currentUser.getId());
        return ResponseEntity.ok(message);
    }

    @GetMapping("/messages/search")
    public ResponseEntity<List<MessageSearchResultResponse>> searchGlobal(
            @RequestParam String query,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal User currentUser) {
        List<MessageSearchResultResponse> results = messageService.searchMessagesGlobal(currentUser.getId(), query, limit);
        return ResponseEntity.ok(results);
    }

    @GetMapping("/{roomKey}/messages/search")
    public ResponseEntity<List<MessageSearchResultResponse>> searchInRoom(
            @PathVariable String roomKey,
            @RequestParam String query,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        List<MessageSearchResultResponse> results = messageService.searchMessagesInRoom(room.getId(), currentUser.getId(), query, limit);
        return ResponseEntity.ok(results);
    }

    @PostMapping(path = "/{roomKey}/messages/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ChatMessageResponse> uploadAttachmentMessage(
            @PathVariable String roomKey,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam(value = "idempotencyKey", required = false) UUID idempotencyKey,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        ChatMessageResponse response = messageService.sendAttachmentMessage(
                room.getId(),
                currentUser.getId(),
                content,
                file,
                idempotencyKey
        );

        messagingTemplate.convertAndSend("/topic/room/" + room.getSlug(), response);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PatchMapping("/{roomKey}/messages/{messageId}")
    public ResponseEntity<ChatMessageResponse> editMessage(
            @PathVariable String roomKey,
            @PathVariable UUID messageId,
            @RequestBody MessageEditRequest request,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        ChatMessageResponse response = messageService.editMessage(
                room.getId(),
                messageId,
                currentUser.getId(),
                request.getContent()
        );

        messagingTemplate.convertAndSend("/topic/room/" + room.getSlug(), response);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{roomKey}/messages/{messageId}")
    public ResponseEntity<ChatMessageResponse> deleteMessage(
            @PathVariable String roomKey,
            @PathVariable UUID messageId,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        ChatMessageResponse response = messageService.deleteMessage(
                room.getId(),
                messageId,
                currentUser.getId()
        );

        messagingTemplate.convertAndSend("/topic/room/" + room.getSlug(), response);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{roomKey}/messages/{messageId}/pin")
    public ResponseEntity<ChatMessageResponse> pinMessage(
            @PathVariable String roomKey,
            @PathVariable UUID messageId,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        ChatMessageResponse response = messageService.pinMessage(
                room.getId(),
                messageId,
                currentUser.getId()
        );
        messagingTemplate.convertAndSend("/topic/room/" + room.getSlug(), response);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{roomKey}/messages/{messageId}/pin")
    public ResponseEntity<ChatMessageResponse> unpinMessage(
            @PathVariable String roomKey,
            @PathVariable UUID messageId,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        ChatMessageResponse response = messageService.unpinMessage(
                room.getId(),
                messageId,
                currentUser.getId()
        );
        messagingTemplate.convertAndSend("/topic/room/" + room.getSlug(), response);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{roomKey}/messages/{messageId}/attachment")
    public ResponseEntity<Resource> downloadAttachment(
            @PathVariable String roomKey,
            @PathVariable UUID messageId,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        MessageService.AttachmentDownload download = messageService.getAttachment(room.getId(), messageId, currentUser.getId());

        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        if (download.contentType() != null && !download.contentType().isBlank()) {
            mediaType = MediaType.parseMediaType(download.contentType());
        }

        ContentDisposition disposition = isInline(download.category())
                ? ContentDisposition.inline().filename(download.fileName()).build()
                : ContentDisposition.attachment().filename(download.fileName()).build();

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(download.resource());
    }

    private boolean isInline(AttachmentCategory category) {
        return category == AttachmentCategory.IMAGE
                || category == AttachmentCategory.VIDEO
                || category == AttachmentCategory.AUDIO;
    }
}

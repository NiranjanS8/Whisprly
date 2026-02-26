package com.chatapp.controller;

import com.chatapp.dto.ChatMessageResponse;
import com.chatapp.dto.MessageEditRequest;
import com.chatapp.model.AttachmentCategory;
import com.chatapp.model.User;
import com.chatapp.service.MessageService;
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

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping("/{roomId}/messages")
    public ResponseEntity<Page<ChatMessageResponse>> getMessages(
            @PathVariable UUID roomId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal User currentUser) {
        Page<ChatMessageResponse> messages = messageService.getMessageHistory(roomId, currentUser.getId(), page, size);
        return ResponseEntity.ok(messages);
    }

    @PostMapping(path = "/{roomId}/messages/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ChatMessageResponse> uploadAttachmentMessage(
            @PathVariable UUID roomId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam(value = "idempotencyKey", required = false) UUID idempotencyKey,
            @AuthenticationPrincipal User currentUser) {
        ChatMessageResponse response = messageService.sendAttachmentMessage(
                roomId,
                currentUser.getId(),
                content,
                file,
                idempotencyKey
        );

        messagingTemplate.convertAndSend("/topic/room/" + roomId, response);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PatchMapping("/{roomId}/messages/{messageId}")
    public ResponseEntity<ChatMessageResponse> editMessage(
            @PathVariable UUID roomId,
            @PathVariable UUID messageId,
            @RequestBody MessageEditRequest request,
            @AuthenticationPrincipal User currentUser) {
        ChatMessageResponse response = messageService.editMessage(
                roomId,
                messageId,
                currentUser.getId(),
                request.getContent()
        );

        messagingTemplate.convertAndSend("/topic/room/" + roomId, response);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{roomId}/messages/{messageId}")
    public ResponseEntity<ChatMessageResponse> deleteMessage(
            @PathVariable UUID roomId,
            @PathVariable UUID messageId,
            @AuthenticationPrincipal User currentUser) {
        ChatMessageResponse response = messageService.deleteMessage(
                roomId,
                messageId,
                currentUser.getId()
        );

        messagingTemplate.convertAndSend("/topic/room/" + roomId, response);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{roomId}/messages/{messageId}/attachment")
    public ResponseEntity<Resource> downloadAttachment(
            @PathVariable UUID roomId,
            @PathVariable UUID messageId,
            @AuthenticationPrincipal User currentUser) {
        MessageService.AttachmentDownload download = messageService.getAttachment(roomId, messageId, currentUser.getId());

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

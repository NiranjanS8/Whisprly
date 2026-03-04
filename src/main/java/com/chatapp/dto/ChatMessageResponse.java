package com.chatapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageResponse {

    private UUID id;
    private UUID idempotencyKey;
    private UUID roomId;
    private UUID senderId;
    private String senderUsername;
    private String senderFullName;
    private String content;
    private AttachmentResponse attachment;
    private Instant createdAt;
    private Instant editedAt;
    private Instant deletedAt;
    private Instant pinnedAt;
    private UUID pinnedById;
    private String pinnedByUsername;
}

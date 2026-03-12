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
public class MessageSearchResultResponse {

    private UUID messageId;
    private UUID roomId;
    private String roomSlug;
    private String roomName;
    private String roomType;
    private UUID senderId;
    private String senderUsername;
    private String senderFullName;
    private String preview;
    private Instant createdAt;
}

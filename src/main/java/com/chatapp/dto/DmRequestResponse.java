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
public class DmRequestResponse {
    private UUID id;
    private UUID requesterId;
    private String requesterUsername;
    private UUID targetId;
    private String targetUsername;
    private String status;
    private Instant createdAt;
    private Instant respondedAt;
}

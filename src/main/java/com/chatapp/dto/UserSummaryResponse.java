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
public class UserSummaryResponse {
    private UUID id;
    private String username;
    private String fullName;
    private String avatarUrl;
    private boolean online;
    private Instant joinedAt;
    private long roomsInCommon;
    private boolean blockedByCurrentUser;
    private boolean blocksCurrentUser;
}

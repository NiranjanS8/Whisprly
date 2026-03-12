package com.chatapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TypingEventResponse {
    private UUID roomId;
    private String roomSlug;
    private UUID userId;
    private String username;
    private boolean typing;
}

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
public class RoomReadReceiptResponse {
    private UUID userId;
    private UUID roomId;
    private String roomSlug;
    private Instant readAt;
}

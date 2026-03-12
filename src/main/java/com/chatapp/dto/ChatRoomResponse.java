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
public class ChatRoomResponse {

    private UUID id;
    private String name;
    private String slug;
    private String inviteCode;
    private String type;
    private UUID createdById;
    private String createdByUsername;
    private Instant createdAt;
    private int memberCount;
    private Integer maxMembers;
    private String allowedMediaTypes;
    private String avatarUrl;
    private String description;
    private Boolean membersCanMessage;
    private Boolean membersCanAddMembers;
    private Integer selfDestructSeconds;
    private Integer unreadCount;
    private Instant pinnedAt;
}

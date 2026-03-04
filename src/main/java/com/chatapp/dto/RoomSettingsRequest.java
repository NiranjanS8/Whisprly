package com.chatapp.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoomSettingsRequest {

    @Size(min = 1, max = 100, message = "Room name must be between 1 and 100 characters")
    private String name;

    @Size(max = 1000, message = "Avatar URL must be at most 1000 characters")
    private String avatarUrl;

    @Size(max = 500, message = "Description must be at most 500 characters")
    private String description;

    private Integer maxMembers;

    private String allowedMediaTypes;

    private Boolean membersCanMessage;

    private Boolean membersCanAddMembers;

    private Integer selfDestructSeconds;
}

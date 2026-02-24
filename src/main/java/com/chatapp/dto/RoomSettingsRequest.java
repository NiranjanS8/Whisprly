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

    private Integer maxMembers;

    private String allowedMediaTypes;
}

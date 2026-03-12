package com.chatapp.event;

import com.chatapp.dto.ChatMessageResponse;
import lombok.Getter;

import java.util.UUID;

@Getter
public class MessageCreatedEvent {

    private final UUID roomId;
    private final String roomSlug;
    private final ChatMessageResponse message;

    public MessageCreatedEvent(UUID roomId, String roomSlug, ChatMessageResponse message) {
        this.roomId = roomId;
        this.roomSlug = roomSlug;
        this.message = message;
    }
}

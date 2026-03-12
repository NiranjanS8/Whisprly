package com.chatapp.event;

import lombok.Getter;

import java.util.List;
import java.util.UUID;

@Getter
public class RoomUpsertedEvent {

    private final UUID roomId;
    private final List<UUID> recipientUserIds;

    public RoomUpsertedEvent(UUID roomId, List<UUID> recipientUserIds) {
        this.roomId = roomId;
        this.recipientUserIds = recipientUserIds;
    }
}

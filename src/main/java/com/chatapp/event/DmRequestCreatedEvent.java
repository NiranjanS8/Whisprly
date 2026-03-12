package com.chatapp.event;

import com.chatapp.dto.DmRequestResponse;
import lombok.Getter;

import java.util.UUID;

@Getter
public class DmRequestCreatedEvent {

    private final UUID targetUserId;
    private final DmRequestResponse request;

    public DmRequestCreatedEvent(UUID targetUserId, DmRequestResponse request) {
        this.targetUserId = targetUserId;
        this.request = request;
    }
}

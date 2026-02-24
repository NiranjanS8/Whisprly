package com.chatapp.service;

import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class PresenceService {

    private final SimpUserRegistry simpUserRegistry;

    public PresenceService(SimpUserRegistry simpUserRegistry) {
        this.simpUserRegistry = simpUserRegistry;
    }

    public boolean isOnline(UUID userId) {
        if (userId == null) {
            return false;
        }
        return simpUserRegistry.getUser(userId.toString()) != null;
    }
}

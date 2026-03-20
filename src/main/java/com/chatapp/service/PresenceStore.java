package com.chatapp.service;

import java.util.Set;
import java.util.UUID;

public interface PresenceStore {

    void registerSession(String sessionId, UUID userId);

    void refreshSession(String sessionId);

    void unregisterSession(String sessionId);

    boolean isOnline(UUID userId);

    Set<UUID> getOnlineUserIds();
}

package com.chatapp.service;

import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InMemoryPresenceStoreTest {

    private final InMemoryPresenceStore presenceStore = new InMemoryPresenceStore();

    @Test
    void userRemainsOnlineUntilLastSessionDisconnects() {
        UUID userId = UUID.randomUUID();

        presenceStore.registerSession("session-a", userId);
        presenceStore.registerSession("session-b", userId);

        assertTrue(presenceStore.isOnline(userId));
        assertEquals(Set.of(userId), presenceStore.getOnlineUserIds());

        presenceStore.unregisterSession("session-a");

        assertTrue(presenceStore.isOnline(userId));
        assertEquals(Set.of(userId), presenceStore.getOnlineUserIds());

        presenceStore.unregisterSession("session-b");

        assertFalse(presenceStore.isOnline(userId));
        assertTrue(presenceStore.getOnlineUserIds().isEmpty());
    }

    @Test
    void reassigningSessionMovesPresenceToNewUser() {
        UUID firstUserId = UUID.randomUUID();
        UUID secondUserId = UUID.randomUUID();

        presenceStore.registerSession("shared-session", firstUserId);
        presenceStore.registerSession("shared-session", secondUserId);

        assertFalse(presenceStore.isOnline(firstUserId));
        assertTrue(presenceStore.isOnline(secondUserId));
        assertEquals(Set.of(secondUserId), presenceStore.getOnlineUserIds());
    }
}

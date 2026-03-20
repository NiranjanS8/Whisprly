package com.chatapp.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RedisPresenceStoreTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private SetOperations<String, String> setOperations;

    private RedisPresenceStore presenceStore;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        lenient().when(redisTemplate.opsForSet()).thenReturn(setOperations);
        presenceStore = new RedisPresenceStore(redisTemplate, 1800, "test:presence");
    }

    @Test
    void registerSessionStoresSessionAndMarksUserOnline() {
        UUID userId = UUID.randomUUID();
        String userIdValue = userId.toString();

        when(valueOperations.get("test:presence:session:session-1")).thenReturn(null);

        presenceStore.registerSession("session-1", userId);

        verify(valueOperations).set(eq("test:presence:session:session-1"), eq(userIdValue), any(Duration.class));
        verify(setOperations).add("test:presence:user:" + userIdValue + ":sessions", "session-1");
        verify(redisTemplate).expire(eq("test:presence:user:" + userIdValue + ":sessions"), any(Duration.class));
        verify(setOperations).add("test:presence:online-users", userIdValue);
        verify(redisTemplate).expire(eq("test:presence:online-users"), any(Duration.class));
    }

    @Test
    void refreshSessionExtendsRedisKeysWhenSessionExists() {
        UUID userId = UUID.randomUUID();
        String userIdValue = userId.toString();

        when(valueOperations.get("test:presence:session:session-1")).thenReturn(userIdValue);

        presenceStore.refreshSession("session-1");

        verify(redisTemplate).expire(eq("test:presence:session:session-1"), any(Duration.class));
        verify(redisTemplate).expire(eq("test:presence:user:" + userIdValue + ":sessions"), any(Duration.class));
        verify(redisTemplate).expire(eq("test:presence:online-users"), any(Duration.class));
    }

    @Test
    void unregisterSessionRemovesUserFromOnlineSetWhenLastSessionDisconnects() {
        UUID userId = UUID.randomUUID();
        String userIdValue = userId.toString();

        when(valueOperations.get("test:presence:session:session-1")).thenReturn(userIdValue);
        when(setOperations.size("test:presence:user:" + userIdValue + ":sessions")).thenReturn(0L);

        presenceStore.unregisterSession("session-1");

        verify(redisTemplate).delete("test:presence:session:session-1");
        verify(setOperations).remove("test:presence:user:" + userIdValue + ":sessions", "session-1");
        verify(redisTemplate).delete("test:presence:user:" + userIdValue + ":sessions");
        verify(setOperations).remove("test:presence:online-users", userIdValue);
    }

    @Test
    void isOnlineReturnsFalseWhenUserHasNoSessions() {
        UUID userId = UUID.randomUUID();

        when(setOperations.size("test:presence:user:" + userId + ":sessions")).thenReturn(0L);

        assertFalse(presenceStore.isOnline(userId));
    }

    @Test
    void getOnlineUserIdsFiltersOutUsersWithoutActiveSessions() {
        UUID onlineUser = UUID.randomUUID();
        UUID offlineUser = UUID.randomUUID();

        when(setOperations.members("test:presence:online-users"))
                .thenReturn(Set.of(onlineUser.toString(), offlineUser.toString(), "not-a-uuid"));
        when(setOperations.size("test:presence:user:" + onlineUser + ":sessions")).thenReturn(1L);
        when(setOperations.size("test:presence:user:" + offlineUser + ":sessions")).thenReturn(0L);

        Set<UUID> onlineUserIds = presenceStore.getOnlineUserIds();

        assertEquals(Set.of(onlineUser), onlineUserIds);
    }

    @Test
    void refreshSessionDoesNothingWhenSessionIsMissing() {
        when(valueOperations.get("test:presence:session:missing")).thenReturn(null);

        presenceStore.refreshSession("missing");

        verify(redisTemplate, never()).expire(eq("test:presence:online-users"), any(Duration.class));
    }
}

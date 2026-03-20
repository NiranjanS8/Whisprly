package com.chatapp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Component
@ConditionalOnProperty(name = "app.presence.store", havingValue = "redis")
@Slf4j
public class RedisPresenceStore implements PresenceStore {

    private final StringRedisTemplate redisTemplate;
    private final Duration sessionTtl;
    private final String keyPrefix;

    public RedisPresenceStore(
            StringRedisTemplate redisTemplate,
            @org.springframework.beans.factory.annotation.Value("${app.presence.session-ttl-seconds:1800}") long sessionTtlSeconds,
            @org.springframework.beans.factory.annotation.Value("${app.presence.redis-key-prefix:chatapp:presence}") String keyPrefix) {
        this.redisTemplate = redisTemplate;
        this.sessionTtl = Duration.ofSeconds(Math.max(60, sessionTtlSeconds));
        this.keyPrefix = keyPrefix;
    }

    @Override
    public void registerSession(String sessionId, UUID userId) {
        if (sessionId == null || sessionId.isBlank() || userId == null) {
            return;
        }

        String sessionKey = sessionKey(sessionId);
        String previousUserId = redisTemplate.opsForValue().get(sessionKey);
        if (previousUserId != null && !previousUserId.equals(userId.toString())) {
            removeSessionFromUser(previousUserId, sessionId);
        }

        redisTemplate.opsForValue().set(sessionKey, userId.toString(), sessionTtl);
        redisTemplate.opsForSet().add(userSessionsKey(userId.toString()), sessionId);
        redisTemplate.expire(userSessionsKey(userId.toString()), sessionTtl);
        redisTemplate.opsForSet().add(onlineUsersKey(), userId.toString());
        redisTemplate.expire(onlineUsersKey(), sessionTtl);
    }

    @Override
    public void refreshSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        String userId = redisTemplate.opsForValue().get(sessionKey(sessionId));
        if (userId == null || userId.isBlank()) {
            return;
        }

        redisTemplate.expire(sessionKey(sessionId), sessionTtl);
        redisTemplate.expire(userSessionsKey(userId), sessionTtl);
        redisTemplate.expire(onlineUsersKey(), sessionTtl);
    }

    @Override
    public void unregisterSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        String sessionKey = sessionKey(sessionId);
        String userId = redisTemplate.opsForValue().get(sessionKey);
        if (userId == null || userId.isBlank()) {
            redisTemplate.delete(sessionKey);
            return;
        }

        redisTemplate.delete(sessionKey);
        removeSessionFromUser(userId, sessionId);
    }

    @Override
    public boolean isOnline(UUID userId) {
        if (userId == null) {
            return false;
        }
        Long size = redisTemplate.opsForSet().size(userSessionsKey(userId.toString()));
        return size != null && size > 0;
    }

    @Override
    public Set<UUID> getOnlineUserIds() {
        Set<String> values = redisTemplate.opsForSet().members(onlineUsersKey());
        if (values == null || values.isEmpty()) {
            return Set.of();
        }

        return values.stream()
                .map(this::safeParseUuid)
                .filter(Objects::nonNull)
                .filter(this::isOnline)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    private void removeSessionFromUser(String userId, String sessionId) {
        String userSessionsKey = userSessionsKey(userId);
        redisTemplate.opsForSet().remove(userSessionsKey, sessionId);
        Long remainingSessions = redisTemplate.opsForSet().size(userSessionsKey);
        if (remainingSessions == null || remainingSessions <= 0) {
            redisTemplate.delete(userSessionsKey);
            redisTemplate.opsForSet().remove(onlineUsersKey(), userId);
        }
    }

    private UUID safeParseUuid(String raw) {
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException ex) {
            log.warn("Ignoring invalid presence user id in Redis: {}", raw);
            return null;
        }
    }

    private String onlineUsersKey() {
        return keyPrefix + ":online-users";
    }

    private String sessionKey(String sessionId) {
        return keyPrefix + ":session:" + sessionId;
    }

    private String userSessionsKey(String userId) {
        return keyPrefix + ":user:" + userId + ":sessions";
    }
}

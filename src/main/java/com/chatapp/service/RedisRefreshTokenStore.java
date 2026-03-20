package com.chatapp.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Component
@ConditionalOnProperty(name = "app.auth.refresh-token.store", havingValue = "redis")
public class RedisRefreshTokenStore implements RefreshTokenStore {

    private final StringRedisTemplate redisTemplate;
    private final String keyPrefix;

    public RedisRefreshTokenStore(
            StringRedisTemplate redisTemplate,
            @org.springframework.beans.factory.annotation.Value("${app.auth.refresh-token.redis-key-prefix:chatapp:auth:refresh}") String keyPrefix) {
        this.redisTemplate = redisTemplate;
        this.keyPrefix = keyPrefix;
    }

    @Override
    public void store(UUID tokenId, UUID userId, Instant expiresAt) {
        if (tokenId == null || userId == null || expiresAt == null) {
            return;
        }

        Duration ttl = Duration.between(Instant.now(), expiresAt);
        if (ttl.isNegative() || ttl.isZero()) {
            return;
        }

        redisTemplate.opsForValue().set(key(tokenId), userId.toString(), ttl);
    }

    @Override
    public boolean isValid(UUID tokenId, UUID userId) {
        if (tokenId == null || userId == null) {
            return false;
        }
        String storedUserId = redisTemplate.opsForValue().get(key(tokenId));
        return userId.toString().equals(storedUserId);
    }

    @Override
    public void revoke(UUID tokenId) {
        if (tokenId != null) {
            redisTemplate.delete(key(tokenId));
        }
    }

    private String key(UUID tokenId) {
        return keyPrefix + ":" + tokenId;
    }
}

package com.chatapp.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
@ConditionalOnProperty(name = "app.auth.refresh-token.store", havingValue = "memory", matchIfMissing = true)
public class InMemoryRefreshTokenStore implements RefreshTokenStore {

    private final Map<UUID, StoredRefreshToken> tokens = new ConcurrentHashMap<>();

    @Override
    public void store(UUID tokenId, UUID userId, Instant expiresAt) {
        tokens.put(tokenId, new StoredRefreshToken(userId, expiresAt));
    }

    @Override
    public boolean isValid(UUID tokenId, UUID userId) {
        if (tokenId == null || userId == null) {
            return false;
        }

        StoredRefreshToken token = tokens.get(tokenId);
        if (token == null) {
            return false;
        }

        if (token.expiresAt() != null && token.expiresAt().isBefore(Instant.now())) {
            tokens.remove(tokenId);
            return false;
        }

        return userId.equals(token.userId());
    }

    @Override
    public void revoke(UUID tokenId) {
        if (tokenId != null) {
            tokens.remove(tokenId);
        }
    }

    private record StoredRefreshToken(UUID userId, Instant expiresAt) {
    }
}

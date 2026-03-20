package com.chatapp.service;

import java.time.Instant;
import java.util.UUID;

public interface RefreshTokenStore {

    void store(UUID tokenId, UUID userId, Instant expiresAt);

    boolean isValid(UUID tokenId, UUID userId);

    void revoke(UUID tokenId);
}

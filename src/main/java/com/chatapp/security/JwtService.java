package com.chatapp.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long accessTokenExpirationMs;
    private final long refreshTokenExpirationMs;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-token-expiration-ms}") long accessTokenExpirationMs,
            @Value("${app.jwt.refresh-token-expiration-ms}") long refreshTokenExpirationMs) {
        validateSecret(secret);
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpirationMs = accessTokenExpirationMs;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;
    }

    private void validateSecret(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "APP_JWT_SECRET must be set. Add it to your environment or create a local .env file based on .env.example.");
        }
        if (secret.contains("replace_with_")) {
            throw new IllegalStateException(
                    "APP_JWT_SECRET is still using a placeholder value. Replace it with a real random secret in your environment or .env file.");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "APP_JWT_SECRET must be at least 32 bytes. Use a longer random secret in your environment or .env file.");
        }
    }

    public String generateAccessToken(UUID userId, String username) {
        return buildToken(userId, username, accessTokenExpirationMs, Map.of("type", "access"));
    }

    public RefreshToken generateRefreshToken(UUID userId, String username) {
        UUID tokenId = UUID.randomUUID();
        Instant expiresAt = Instant.now().plusMillis(refreshTokenExpirationMs);
        String token = buildToken(userId, username, refreshTokenExpirationMs, Map.of("type", "refresh", "jti", tokenId.toString()));
        return new RefreshToken(token, tokenId, expiresAt);
    }

    private String buildToken(UUID userId, String username, long expirationMs, Map<String, Object> extraClaims) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(userId.toString())
                .claim("username", username)
                .claims(extraClaims)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey)
                .compact();
    }

    public boolean isTokenValid(String token) {
        try {
            extractAllClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public UUID extractUserId(String token) {
        String subject = extractClaim(token, Claims::getSubject);
        return UUID.fromString(subject);
    }

    public String extractUsername(String token) {
        return extractClaim(token, claims -> claims.get("username", String.class));
    }

    public String extractTokenType(String token) {
        return extractClaim(token, claims -> claims.get("type", String.class));
    }

    public UUID extractTokenId(String token) {
        String tokenId = extractClaim(token, claims -> claims.get("jti", String.class));
        return tokenId == null ? null : UUID.fromString(tokenId);
    }

    public Instant extractExpiration(String token) {
        Date expiration = extractClaim(token, Claims::getExpiration);
        return expiration == null ? null : expiration.toInstant();
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public record RefreshToken(String value, UUID tokenId, Instant expiresAt) {
    }
}

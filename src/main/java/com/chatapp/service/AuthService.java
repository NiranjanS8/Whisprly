package com.chatapp.service;

import com.chatapp.dto.AuthResponse;
import com.chatapp.dto.GoogleAuthRequest;
import com.chatapp.dto.LoginRequest;
import com.chatapp.dto.RefreshTokenRequest;
import com.chatapp.dto.RegisterRequest;
import com.chatapp.exception.DuplicateResourceException;
import com.chatapp.exception.UnauthorizedException;
import com.chatapp.model.User;
import com.chatapp.observability.AppMetrics;
import com.chatapp.repository.UserRepository;
import com.chatapp.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenStore refreshTokenStore;
    private final GoogleIdentityService googleIdentityService;
    private final AppMetrics appMetrics;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new DuplicateResourceException("Username already taken");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Email already registered");
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .build();

        User saved = userRepository.save(user);
        appMetrics.recordRegistration();
        log.info("User registered: username={}", saved.getUsername());

        return issueTokens(saved);
    }

    public AuthResponse login(LoginRequest request) {
        String identifier = request.getIdentifier().trim();
        User user = userRepository.findByUsernameIgnoreCase(identifier)
                .or(() -> userRepository.findByEmailIgnoreCase(identifier))
                .orElseThrow(() -> new UnauthorizedException("User does not exist"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new UnauthorizedException("Password does not match");
        }

        appMetrics.recordLogin();
        log.info("User logged in: username={}", user.getUsername());
        return issueTokens(user);
    }

    @Transactional
    public AuthResponse googleLogin(GoogleAuthRequest request) {
        GoogleIdentityService.GoogleIdentity identity = googleIdentityService.verify(request.getIdToken());

        User user = userRepository.findByEmail(identity.email())
                .map(existingUser -> updateGoogleProfile(existingUser, identity))
                .orElseGet(() -> createGoogleUser(identity));

        appMetrics.recordGoogleLogin();
        log.info("Google sign-in completed: email={}", user.getEmail());
        return issueTokens(user);
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request) {
        String refreshTokenValue = request.getRefreshToken();
        if (!jwtService.isTokenValid(refreshTokenValue)) {
            throw new UnauthorizedException("Invalid refresh token");
        }
        if (!"refresh".equals(jwtService.extractTokenType(refreshTokenValue))) {
            throw new UnauthorizedException("Invalid token type");
        }

        java.util.UUID userId = jwtService.extractUserId(refreshTokenValue);
        java.util.UUID tokenId = jwtService.extractTokenId(refreshTokenValue);

        if (tokenId == null || !refreshTokenStore.isValid(tokenId, userId)) {
            throw new UnauthorizedException("Refresh token has been revoked");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("User not found"));

        refreshTokenStore.revoke(tokenId);
        appMetrics.recordRefreshRotation();
        log.info("Refresh token rotated: userId={}", userId);
        return issueTokens(user);
    }

    public void logout(RefreshTokenRequest request) {
        String refreshTokenValue = request.getRefreshToken();
        if (!jwtService.isTokenValid(refreshTokenValue)) {
            return;
        }
        if (!"refresh".equals(jwtService.extractTokenType(refreshTokenValue))) {
            return;
        }

        java.util.UUID tokenId = jwtService.extractTokenId(refreshTokenValue);
        refreshTokenStore.revoke(tokenId);
        appMetrics.recordLogout();
    }

    private User createGoogleUser(GoogleIdentityService.GoogleIdentity identity) {
        String username = generateUniqueUsername(identity.email(), identity.fullName());
        User user = User.builder()
                .username(username)
                .email(identity.email())
                .fullName(identity.fullName())
                .avatarUrl(identity.avatarUrl())
                .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                .build();
        return userRepository.save(user);
    }

    private User updateGoogleProfile(User user, GoogleIdentityService.GoogleIdentity identity) {
        boolean changed = false;

        if ((user.getFullName() == null || user.getFullName().isBlank())
                && identity.fullName() != null && !identity.fullName().isBlank()) {
            user.setFullName(identity.fullName());
            changed = true;
        }

        if ((user.getAvatarUrl() == null || user.getAvatarUrl().isBlank())
                && identity.avatarUrl() != null && !identity.avatarUrl().isBlank()) {
            user.setAvatarUrl(identity.avatarUrl());
            changed = true;
        }

        return changed ? userRepository.save(user) : user;
    }

    private String generateUniqueUsername(String email, String fullName) {
        String candidate = sanitizeUsername(baseUsername(email, fullName));
        if (!userRepository.existsByUsernameIgnoreCase(candidate)) {
            return candidate;
        }

        for (int attempt = 1; attempt <= 100; attempt++) {
            String variant = candidate + attempt;
            if (!userRepository.existsByUsernameIgnoreCase(variant)) {
                return variant;
            }
        }

        return candidate + UUID.randomUUID().toString().substring(0, 8);
    }

    private String baseUsername(String email, String fullName) {
        if (fullName != null && !fullName.isBlank()) {
            return fullName;
        }
        int atIndex = email.indexOf('@');
        return atIndex > 0 ? email.substring(0, atIndex) : email;
    }

    private String sanitizeUsername(String raw) {
        String normalized = raw == null ? "user" : raw.toLowerCase(Locale.ROOT).trim();
        normalized = normalized.replaceAll("[^a-z0-9._-]+", "");
        if (normalized.length() < 3) {
            normalized = normalized + "user";
        }
        if (normalized.length() > 50) {
            normalized = normalized.substring(0, 50);
        }
        return normalized;
    }

    private AuthResponse issueTokens(User user) {
        String accessToken = jwtService.generateAccessToken(user.getId(), user.getUsername());
        JwtService.RefreshToken refreshToken = jwtService.generateRefreshToken(user.getId(), user.getUsername());
        refreshTokenStore.store(refreshToken.tokenId(), user.getId(), refreshToken.expiresAt());

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken.value())
                .tokenType("Bearer")
                .userId(user.getId())
                .username(user.getUsername())
                .build();
    }
}

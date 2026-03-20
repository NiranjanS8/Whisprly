package com.chatapp.service;

import com.chatapp.dto.AuthResponse;
import com.chatapp.dto.LoginRequest;
import com.chatapp.dto.RefreshTokenRequest;
import com.chatapp.dto.RegisterRequest;
import com.chatapp.exception.DuplicateResourceException;
import com.chatapp.exception.UnauthorizedException;
import com.chatapp.model.User;
import com.chatapp.repository.UserRepository;
import com.chatapp.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final RefreshTokenStore refreshTokenStore;

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
        log.info("User registered: username={}", saved.getUsername());

        return issueTokens(saved);
    }

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));

        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow();

        log.info("User logged in: username={}", user.getUsername());
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

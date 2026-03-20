package com.chatapp.service;

import com.chatapp.dto.AuthResponse;
import com.chatapp.dto.RefreshTokenRequest;
import com.chatapp.dto.RegisterRequest;
import com.chatapp.exception.UnauthorizedException;
import com.chatapp.model.User;
import com.chatapp.repository.UserRepository;
import com.chatapp.security.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private RefreshTokenStore refreshTokenStore;

    @InjectMocks
    private AuthService authService;

    @Test
    void registerStoresRefreshTokenAndReturnsIssuedTokens() {
        RegisterRequest request = new RegisterRequest("alice", "alice@example.com", "password123");
        UUID userId = UUID.randomUUID();
        UUID refreshTokenId = UUID.randomUUID();
        Instant refreshExpiry = Instant.now().plusSeconds(600);
        User savedUser = User.builder()
                .id(userId)
                .username("alice")
                .email("alice@example.com")
                .password("encoded-password")
                .build();

        when(userRepository.existsByUsername("alice")).thenReturn(false);
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtService.generateAccessToken(userId, "alice")).thenReturn("access-token");
        when(jwtService.generateRefreshToken(userId, "alice"))
                .thenReturn(new JwtService.RefreshToken("refresh-token", refreshTokenId, refreshExpiry));

        AuthResponse response = authService.register(request);

        assertEquals("access-token", response.getAccessToken());
        assertEquals("refresh-token", response.getRefreshToken());
        assertEquals(userId, response.getUserId());
        assertEquals("alice", response.getUsername());
        verify(refreshTokenStore).store(refreshTokenId, userId, refreshExpiry);
    }

    @Test
    void refreshRevokesOldTokenAndStoresRotatedToken() {
        UUID userId = UUID.randomUUID();
        UUID oldTokenId = UUID.randomUUID();
        UUID newTokenId = UUID.randomUUID();
        Instant newExpiry = Instant.now().plusSeconds(900);
        User user = User.builder()
                .id(userId)
                .username("alice")
                .email("alice@example.com")
                .password("encoded")
                .build();

        when(jwtService.isTokenValid("old-refresh")).thenReturn(true);
        when(jwtService.extractTokenType("old-refresh")).thenReturn("refresh");
        when(jwtService.extractUserId("old-refresh")).thenReturn(userId);
        when(jwtService.extractTokenId("old-refresh")).thenReturn(oldTokenId);
        when(refreshTokenStore.isValid(oldTokenId, userId)).thenReturn(true);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(userId, "alice")).thenReturn("new-access");
        when(jwtService.generateRefreshToken(userId, "alice"))
                .thenReturn(new JwtService.RefreshToken("new-refresh", newTokenId, newExpiry));

        AuthResponse response = authService.refresh(new RefreshTokenRequest("old-refresh"));

        assertEquals("new-access", response.getAccessToken());
        assertEquals("new-refresh", response.getRefreshToken());
        verify(refreshTokenStore).revoke(oldTokenId);
        verify(refreshTokenStore).store(newTokenId, userId, newExpiry);
    }

    @Test
    void refreshRejectsRevokedRefreshToken() {
        UUID userId = UUID.randomUUID();
        UUID oldTokenId = UUID.randomUUID();

        when(jwtService.isTokenValid("old-refresh")).thenReturn(true);
        when(jwtService.extractTokenType("old-refresh")).thenReturn("refresh");
        when(jwtService.extractUserId("old-refresh")).thenReturn(userId);
        when(jwtService.extractTokenId("old-refresh")).thenReturn(oldTokenId);
        when(refreshTokenStore.isValid(oldTokenId, userId)).thenReturn(false);

        assertThrows(UnauthorizedException.class, () -> authService.refresh(new RefreshTokenRequest("old-refresh")));

        verify(refreshTokenStore, never()).revoke(oldTokenId);
        verify(refreshTokenStore, never()).store(any(), any(), any());
    }
}

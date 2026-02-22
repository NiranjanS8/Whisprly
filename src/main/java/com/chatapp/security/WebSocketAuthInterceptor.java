package com.chatapp.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketAuthInterceptor implements HandshakeInterceptor {

    private final JwtService jwtService;

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes) {

        String token = extractTokenFromQuery(request);

        if (token == null || !jwtService.isTokenValid(token)) {
            log.warn("WebSocket handshake rejected: invalid or missing token");
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        String tokenType = jwtService.extractTokenType(token);
        if (!"access".equals(tokenType)) {
            log.warn("WebSocket handshake rejected: non-access token used");
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        UUID userId = jwtService.extractUserId(token);
        String username = jwtService.extractUsername(token);

        attributes.put("userId", userId);
        attributes.put("username", username);

        log.debug("WebSocket handshake authenticated: userId={}", userId);
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception) {
        // No-op
    }

    private String extractTokenFromQuery(ServerHttpRequest request) {
        try {
            return UriComponentsBuilder.fromUri(request.getURI())
                    .build()
                    .getQueryParams()
                    .getFirst("token");
        } catch (Exception e) {
            return null;
        }
    }
}

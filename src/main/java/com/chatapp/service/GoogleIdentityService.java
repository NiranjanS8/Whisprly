package com.chatapp.service;

import com.chatapp.exception.UnauthorizedException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;

@Service
public class GoogleIdentityService {

    private final RestClient restClient;
    private final String googleClientId;

    public GoogleIdentityService(@Value("${app.auth.google.client-id:}") String googleClientId) {
        this.restClient = RestClient.builder()
                .baseUrl("https://oauth2.googleapis.com")
                .build();
        this.googleClientId = googleClientId == null ? "" : googleClientId.trim();
    }

    public GoogleIdentity verify(String idToken) {
        if (googleClientId.isBlank()) {
            throw new IllegalStateException("APP_GOOGLE_CLIENT_ID must be configured to use Google sign-in");
        }

        try {
            Map<String, Object> response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/tokeninfo")
                            .queryParam("id_token", idToken)
                            .build())
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});

            if (response == null || response.isEmpty()) {
                throw new UnauthorizedException("Invalid Google token");
            }

            String audience = asString(response.get("aud"));
            if (!googleClientId.equals(audience)) {
                throw new UnauthorizedException("Google token audience mismatch");
            }

            if (!asBoolean(response.get("email_verified"))) {
                throw new UnauthorizedException("Google account email is not verified");
            }

            String email = asString(response.get("email"));
            if (email == null || email.isBlank()) {
                throw new UnauthorizedException("Google account email is missing");
            }

            return new GoogleIdentity(
                    asString(response.get("sub")),
                    email,
                    asString(response.get("name")),
                    asString(response.get("picture"))
            );
        } catch (RestClientException ex) {
            throw new UnauthorizedException("Failed to verify Google token");
        }
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value).trim();
    }

    private boolean asBoolean(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        return value != null && "true".equalsIgnoreCase(String.valueOf(value).trim());
    }

    public record GoogleIdentity(
            String subject,
            String email,
            String fullName,
            String avatarUrl
    ) {
    }
}

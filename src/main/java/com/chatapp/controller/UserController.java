package com.chatapp.controller;

import com.chatapp.model.User;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    @GetMapping("/search")
    public ResponseEntity<List<Map<String, Object>>> searchUsers(
            @RequestParam String username,
            @AuthenticationPrincipal User currentUser) {

        List<Map<String, Object>> results = userRepository
                .findByUsernameContainingIgnoreCase(username)
                .stream()
                .filter(u -> !u.getId().equals(currentUser.getId()))
                .limit(10)
                .map(u -> Map.<String, Object>of(
                        "id", u.getId(),
                        "username", u.getUsername()))
                .collect(Collectors.toList());

        return ResponseEntity.ok(results);
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser(
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(Map.of(
                "id", currentUser.getId(),
                "username", currentUser.getUsername()));
    }
}

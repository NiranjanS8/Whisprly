package com.chatapp.controller;

import com.chatapp.dto.UpdateUserProfileRequest;
import com.chatapp.dto.UserProfileResponse;
import com.chatapp.dto.UserSummaryResponse;
import com.chatapp.exception.DuplicateResourceException;
import com.chatapp.exception.ResourceNotFoundException;
import com.chatapp.model.User;
import com.chatapp.repository.ChatRoomMemberRepository;
import com.chatapp.repository.UserRepository;
import com.chatapp.service.PresenceService;
import com.chatapp.service.UserBlockService;
import jakarta.validation.Valid;
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
    private final PresenceService presenceService;
    private final ChatRoomMemberRepository chatRoomMemberRepository;
    private final UserBlockService userBlockService;

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
    public ResponseEntity<UserProfileResponse> getCurrentUser(
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(toProfileResponse(currentUser));
    }

    @GetMapping("/{userId}/summary")
    public ResponseEntity<UserSummaryResponse> getUserSummary(
            @PathVariable UUID userId,
            @AuthenticationPrincipal User currentUser) {
        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return ResponseEntity.ok(toSummaryResponse(targetUser, currentUser.getId()));
    }

    @GetMapping("/by-username/{username}/summary")
    public ResponseEntity<UserSummaryResponse> getUserSummaryByUsername(
            @PathVariable String username,
            @AuthenticationPrincipal User currentUser) {
        User targetUser = userRepository.findByUsernameIgnoreCase(username.trim())
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));

        return ResponseEntity.ok(toSummaryResponse(targetUser, currentUser.getId()));
    }

    @PostMapping("/{userId}/block")
    public ResponseEntity<Map<String, Object>> blockUser(
            @PathVariable UUID userId,
            @AuthenticationPrincipal User currentUser) {
        userBlockService.blockUser(currentUser.getId(), userId);
        return ResponseEntity.ok(Map.of("blocked", true));
    }

    @DeleteMapping("/{userId}/block")
    public ResponseEntity<Map<String, Object>> unblockUser(
            @PathVariable UUID userId,
            @AuthenticationPrincipal User currentUser) {
        userBlockService.unblockUser(currentUser.getId(), userId);
        return ResponseEntity.ok(Map.of("blocked", false));
    }

    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateCurrentUser(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody UpdateUserProfileRequest request) {

        if (request.getUsername() != null && !request.getUsername().isBlank()) {
            String trimmedUsername = request.getUsername().trim();
            if (!trimmedUsername.equals(currentUser.getUsername()) &&
                    userRepository.existsByUsername(trimmedUsername)) {
                throw new DuplicateResourceException("Username already taken");
            }
            currentUser.setUsername(trimmedUsername);
        }

        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            String trimmedEmail = request.getEmail().trim();
            if (!trimmedEmail.equalsIgnoreCase(currentUser.getEmail()) &&
                    userRepository.existsByEmail(trimmedEmail)) {
                throw new DuplicateResourceException("Email already registered");
            }
            currentUser.setEmail(trimmedEmail);
        }

        if (request.getFullName() != null) {
            currentUser.setFullName(request.getFullName().isBlank() ? null : request.getFullName().trim());
        }

        if (request.getBio() != null) {
            currentUser.setBio(request.getBio().isBlank() ? null : request.getBio().trim());
        }

        if (request.getAvatarUrl() != null) {
            currentUser.setAvatarUrl(request.getAvatarUrl().isBlank() ? null : request.getAvatarUrl().trim());
        }

        User saved = userRepository.save(currentUser);
        return ResponseEntity.ok(toProfileResponse(saved));
    }

    private UserProfileResponse toProfileResponse(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .bio(user.getBio())
                .avatarUrl(user.getAvatarUrl())
                .build();
    }

    private UserSummaryResponse toSummaryResponse(User user, UUID currentUserId) {
        long roomsInCommon = user.getId().equals(currentUserId)
                ? 0
                : chatRoomMemberRepository.countRoomsInCommon(currentUserId, user.getId());
        return UserSummaryResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .online(presenceService.isOnline(user.getId()))
                .joinedAt(user.getCreatedAt())
                .roomsInCommon(roomsInCommon)
                .blockedByCurrentUser(userBlockService.isBlockedByCurrentUser(currentUserId, user.getId()))
                .blocksCurrentUser(userBlockService.hasBlockedCurrentUser(currentUserId, user.getId()))
                .build();
    }
}

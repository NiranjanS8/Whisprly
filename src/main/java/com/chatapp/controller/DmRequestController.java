package com.chatapp.controller;

import com.chatapp.dto.ChatRoomResponse;
import com.chatapp.dto.DmRequestResponse;
import com.chatapp.model.User;
import com.chatapp.service.DmRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/dm-requests")
@RequiredArgsConstructor
public class DmRequestController {

    private final DmRequestService dmRequestService;

    @PostMapping("/{targetUserId}")
    public ResponseEntity<DmRequestResponse> sendRequest(
            @PathVariable UUID targetUserId,
            @AuthenticationPrincipal User currentUser) {
        DmRequestResponse response = dmRequestService.sendRequest(currentUser.getId(), targetUserId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/by-username/{username}")
    public ResponseEntity<DmRequestResponse> sendRequestByUsername(
            @PathVariable String username,
            @AuthenticationPrincipal User currentUser) {
        DmRequestResponse response = dmRequestService.sendRequestByUsername(currentUser.getId(), username);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/incoming")
    public ResponseEntity<List<DmRequestResponse>> getIncoming(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(dmRequestService.getIncoming(currentUser.getId()));
    }

    @GetMapping("/sent")
    public ResponseEntity<List<DmRequestResponse>> getSent(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(dmRequestService.getSent(currentUser.getId()));
    }

    @PostMapping("/{requestId}/accept")
    public ResponseEntity<ChatRoomResponse> accept(
            @PathVariable UUID requestId,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(dmRequestService.accept(requestId, currentUser.getId()));
    }

    @PostMapping("/{requestId}/reject")
    public ResponseEntity<DmRequestResponse> reject(
            @PathVariable UUID requestId,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(dmRequestService.reject(requestId, currentUser.getId()));
    }
}

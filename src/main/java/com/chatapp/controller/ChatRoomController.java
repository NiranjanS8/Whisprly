package com.chatapp.controller;

import com.chatapp.dto.AddMemberRequest;
import com.chatapp.dto.ChatRoomRequest;
import com.chatapp.dto.ChatRoomResponse;
import com.chatapp.dto.MemberResponse;
import com.chatapp.dto.RoomUnreadUpdateResponse;
import com.chatapp.dto.RoomSettingsRequest;
import com.chatapp.dto.TransferOwnershipRequest;
import com.chatapp.model.User;
import com.chatapp.service.ChatRoomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class ChatRoomController {

    private final ChatRoomService chatRoomService;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping
    public ResponseEntity<ChatRoomResponse> createRoom(
            @Valid @RequestBody ChatRoomRequest request,
            @AuthenticationPrincipal User currentUser) {
        ChatRoomResponse response = chatRoomService.createRoom(
                request.getName(),
                currentUser.getId(),
                request.getMaxMembers(),
                request.getAllowedMediaTypes());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<ChatRoomResponse>> getUserRooms(@AuthenticationPrincipal User currentUser) {
        List<ChatRoomResponse> rooms = chatRoomService.getUserRooms(currentUser.getId());
        return ResponseEntity.ok(rooms);
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<ChatRoomResponse> getRoomDetails(
            @PathVariable UUID roomId,
            @AuthenticationPrincipal User currentUser) {
        ChatRoomResponse response = chatRoomService.getRoomDetails(roomId, currentUser.getId());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{roomId}/members")
    public ResponseEntity<List<MemberResponse>> getRoomMembers(
            @PathVariable UUID roomId,
            @AuthenticationPrincipal User currentUser) {
        List<MemberResponse> members = chatRoomService.getRoomMembers(roomId, currentUser.getId());
        return ResponseEntity.ok(members);
    }

    @PostMapping("/{roomId}/members")
    public ResponseEntity<MemberResponse> addMember(
            @PathVariable UUID roomId,
            @Valid @RequestBody AddMemberRequest request,
            @AuthenticationPrincipal User currentUser) {
        MemberResponse response = chatRoomService.addMember(roomId, request.getUserId(), currentUser.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/{roomId}/members/{userId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable UUID roomId,
            @PathVariable UUID userId,
            @AuthenticationPrincipal User currentUser) {
        chatRoomService.removeMember(roomId, userId, currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{roomId}")
    public ResponseEntity<Void> deleteRoom(
            @PathVariable UUID roomId,
            @AuthenticationPrincipal User currentUser) {
        chatRoomService.deleteRoom(roomId, currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{roomId}/join")
    public ResponseEntity<ChatRoomResponse> joinRoom(
            @PathVariable UUID roomId,
            @AuthenticationPrincipal User currentUser) {
        ChatRoomResponse response = chatRoomService.joinRoom(roomId, currentUser.getId());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{roomId}/settings")
    public ResponseEntity<ChatRoomResponse> updateRoomSettings(
            @PathVariable UUID roomId,
            @Valid @RequestBody RoomSettingsRequest request,
            @AuthenticationPrincipal User currentUser) {
        ChatRoomResponse response = chatRoomService.updateRoomSettings(roomId, request, currentUser.getId());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{roomId}/read")
    public ResponseEntity<RoomUnreadUpdateResponse> markRoomAsRead(
            @PathVariable UUID roomId,
            @AuthenticationPrincipal User currentUser) {
        RoomUnreadUpdateResponse response = chatRoomService.markRoomAsRead(roomId, currentUser.getId());
        messagingTemplate.convertAndSendToUser(currentUser.getId().toString(), "/queue/rooms/unread", response);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{roomId}/transfer-ownership")
    public ResponseEntity<ChatRoomResponse> transferOwnership(
            @PathVariable UUID roomId,
            @Valid @RequestBody TransferOwnershipRequest request,
            @AuthenticationPrincipal User currentUser) {
        ChatRoomResponse response = chatRoomService.transferOwnership(roomId, request.getNewOwnerUserId(), currentUser.getId());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/dm/{targetUserId}")
    public ResponseEntity<ChatRoomResponse> startDm(
            @PathVariable UUID targetUserId,
            @AuthenticationPrincipal User currentUser) {
        ChatRoomResponse response = chatRoomService.getOrCreateDmRoom(currentUser.getId(), targetUserId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/dm/by-username/{username}")
    public ResponseEntity<ChatRoomResponse> startDmByUsername(
            @PathVariable String username,
            @AuthenticationPrincipal User currentUser) {
        ChatRoomResponse response = chatRoomService.getOrCreateDmRoomByUsername(currentUser.getId(), username);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{roomId}/pin")
    public ResponseEntity<ChatRoomResponse> pinRoom(
            @PathVariable UUID roomId,
            @AuthenticationPrincipal User currentUser) {
        ChatRoomResponse response = chatRoomService.pinRoom(roomId, currentUser.getId());
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{roomId}/pin")
    public ResponseEntity<ChatRoomResponse> unpinRoom(
            @PathVariable UUID roomId,
            @AuthenticationPrincipal User currentUser) {
        ChatRoomResponse response = chatRoomService.unpinRoom(roomId, currentUser.getId());
        return ResponseEntity.ok(response);
    }
}

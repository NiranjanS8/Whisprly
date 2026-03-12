package com.chatapp.controller;

import com.chatapp.dto.AddMemberRequest;
import com.chatapp.dto.ChatRoomRequest;
import com.chatapp.dto.ChatRoomResponse;
import com.chatapp.dto.MemberResponse;
import com.chatapp.dto.RoomUnreadUpdateResponse;
import com.chatapp.dto.RoomSettingsRequest;
import com.chatapp.dto.TransferOwnershipRequest;
import com.chatapp.model.ChatRoom;
import com.chatapp.model.User;
import com.chatapp.service.ChatRoomService;
import com.chatapp.service.RoomPublicIdService;
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
    private final RoomPublicIdService roomPublicIdService;
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

    @GetMapping("/{roomKey}")
    public ResponseEntity<ChatRoomResponse> getRoomDetails(
            @PathVariable String roomKey,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        ChatRoomResponse response = chatRoomService.getRoomDetails(room.getId(), currentUser.getId());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{roomKey}/members")
    public ResponseEntity<List<MemberResponse>> getRoomMembers(
            @PathVariable String roomKey,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        List<MemberResponse> members = chatRoomService.getRoomMembers(room.getId(), currentUser.getId());
        return ResponseEntity.ok(members);
    }

    @PostMapping("/{roomKey}/members")
    public ResponseEntity<MemberResponse> addMember(
            @PathVariable String roomKey,
            @Valid @RequestBody AddMemberRequest request,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        MemberResponse response = chatRoomService.addMember(room.getId(), request.getUserId(), currentUser.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/{roomKey}/members/{userId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable String roomKey,
            @PathVariable UUID userId,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        chatRoomService.removeMember(room.getId(), userId, currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{roomKey}")
    public ResponseEntity<Void> deleteRoom(
            @PathVariable String roomKey,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        chatRoomService.deleteRoom(room.getId(), currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/join/{inviteCode}")
    public ResponseEntity<ChatRoomResponse> joinRoomByInviteCode(
            @PathVariable String inviteCode,
            @AuthenticationPrincipal User currentUser) {
        ChatRoomResponse response = chatRoomService.joinRoomByInviteCode(inviteCode, currentUser.getId());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{roomKey}/settings")
    public ResponseEntity<ChatRoomResponse> updateRoomSettings(
            @PathVariable String roomKey,
            @Valid @RequestBody RoomSettingsRequest request,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        ChatRoomResponse response = chatRoomService.updateRoomSettings(room.getId(), request, currentUser.getId());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{roomKey}/read")
    public ResponseEntity<RoomUnreadUpdateResponse> markRoomAsRead(
            @PathVariable String roomKey,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        RoomUnreadUpdateResponse response = chatRoomService.markRoomAsRead(room.getId(), currentUser.getId());
        messagingTemplate.convertAndSendToUser(currentUser.getId().toString(), "/queue/rooms/unread", response);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{roomKey}/transfer-ownership")
    public ResponseEntity<ChatRoomResponse> transferOwnership(
            @PathVariable String roomKey,
            @Valid @RequestBody TransferOwnershipRequest request,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        ChatRoomResponse response = chatRoomService.transferOwnership(room.getId(), request.getNewOwnerUserId(), currentUser.getId());
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

    @PostMapping("/{roomKey}/pin")
    public ResponseEntity<ChatRoomResponse> pinRoom(
            @PathVariable String roomKey,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        ChatRoomResponse response = chatRoomService.pinRoom(room.getId(), currentUser.getId());
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{roomKey}/pin")
    public ResponseEntity<ChatRoomResponse> unpinRoom(
            @PathVariable String roomKey,
            @AuthenticationPrincipal User currentUser) {
        ChatRoom room = roomPublicIdService.resolveRoom(roomKey);
        ChatRoomResponse response = chatRoomService.unpinRoom(room.getId(), currentUser.getId());
        return ResponseEntity.ok(response);
    }
}

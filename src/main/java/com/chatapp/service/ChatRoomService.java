package com.chatapp.service;

import com.chatapp.dto.ChatRoomResponse;
import com.chatapp.dto.MemberResponse;
import com.chatapp.dto.RoomSettingsRequest;
import com.chatapp.exception.DuplicateResourceException;
import com.chatapp.exception.ResourceNotFoundException;
import com.chatapp.model.ChatRoom;
import com.chatapp.model.ChatRoomMember;
import com.chatapp.model.MemberRole;
import com.chatapp.model.RoomType;
import com.chatapp.model.User;
import com.chatapp.repository.ChatRoomMemberRepository;
import com.chatapp.repository.ChatRoomRepository;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatRoomService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomMemberRepository memberRepository;
    private final UserRepository userRepository;

    @Transactional
    public ChatRoomResponse createRoom(String name, UUID creatorId, Integer maxMembers, String allowedMediaTypes) {
        User creator = userRepository.findById(creatorId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", creatorId));

        ChatRoom.ChatRoomBuilder builder = ChatRoom.builder()
                .name(name)
                .type(RoomType.GROUP)
                .createdBy(creator);

        if (maxMembers != null) {
            builder.maxMembers(maxMembers);
        }
        if (allowedMediaTypes != null && !allowedMediaTypes.isBlank()) {
            builder.allowedMediaTypes(allowedMediaTypes);
        }

        ChatRoom room = chatRoomRepository.save(builder.build());

        ChatRoomMember ownerMember = ChatRoomMember.builder()
                .room(room)
                .user(creator)
                .role(MemberRole.OWNER)
                .build();
        memberRepository.save(ownerMember);

        log.info("Room created: id={}, name={}, creator={}", room.getId(), name, creatorId);

        return toResponse(room, 1);
    }

    @Transactional(readOnly = true)
    public List<ChatRoomResponse> getUserRooms(UUID userId) {
        List<ChatRoom> rooms = chatRoomRepository.findRoomsByUserId(userId);
        return rooms.stream()
                .map(room -> {
                    int memberCount = memberRepository.findMembersWithUserByRoomId(room.getId()).size();
                    return toResponse(room, memberCount);
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ChatRoomResponse getRoomDetails(UUID roomId, UUID userId) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", "id", roomId));

        if (!memberRepository.existsByRoomIdAndUserId(roomId, userId)) {
            throw new AccessDeniedException("You are not a member of this room");
        }

        int memberCount = memberRepository.findMembersWithUserByRoomId(roomId).size();
        return toResponse(room, memberCount);
    }

    @Transactional(readOnly = true)
    public List<MemberResponse> getRoomMembers(UUID roomId, UUID userId) {
        if (!memberRepository.existsByRoomIdAndUserId(roomId, userId)) {
            throw new AccessDeniedException("You are not a member of this room");
        }

        return memberRepository.findMembersWithUserByRoomId(roomId).stream()
                .map(this::toMemberResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ChatRoomResponse updateRoomSettings(UUID roomId, RoomSettingsRequest request, UUID userId) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", "id", roomId));

        ChatRoomMember requester = memberRepository.findByRoomIdAndUserId(roomId, userId)
                .orElseThrow(() -> new AccessDeniedException("You are not a member of this room"));

        if (requester.getRole() != MemberRole.OWNER && requester.getRole() != MemberRole.ADMIN) {
            throw new AccessDeniedException("Only OWNER or ADMIN can update room settings");
        }

        if (request.getName() != null && !request.getName().isBlank()) {
            room.setName(request.getName());
        }
        if (request.getMaxMembers() != null) {
            room.setMaxMembers(request.getMaxMembers());
        }
        if (request.getAllowedMediaTypes() != null) {
            room.setAllowedMediaTypes(request.getAllowedMediaTypes());
        }

        room = chatRoomRepository.save(room);
        int memberCount = memberRepository.findMembersWithUserByRoomId(roomId).size();
        log.info("Room settings updated: roomId={}, updatedBy={}", roomId, userId);

        return toResponse(room, memberCount);
    }

    @Transactional
    public ChatRoomResponse joinRoom(UUID roomId, UUID userId) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", "id", roomId));

        if (room.getType() == RoomType.DM) {
            throw new AccessDeniedException("Cannot join a direct message room");
        }

        if (memberRepository.existsByRoomIdAndUserId(roomId, userId)) {
            throw new DuplicateResourceException("You are already a member of this room");
        }

        // Enforce max members
        int currentCount = memberRepository.findMembersWithUserByRoomId(roomId).size();
        if (room.getMaxMembers() != null && currentCount >= room.getMaxMembers()) {
            throw new IllegalStateException("Room has reached its maximum member limit");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        ChatRoomMember member = ChatRoomMember.builder()
                .room(room)
                .user(user)
                .role(MemberRole.MEMBER)
                .build();
        memberRepository.save(member);

        log.info("User joined room: roomId={}, userId={}", roomId, userId);

        return toResponse(room, currentCount + 1);
    }

    @Transactional
    public MemberResponse addMember(UUID roomId, UUID targetUserId, UUID requesterId) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", "id", roomId));

        ChatRoomMember requester = memberRepository.findByRoomIdAndUserId(roomId, requesterId)
                .orElseThrow(() -> new AccessDeniedException("You are not a member of this room"));

        if (requester.getRole() != MemberRole.OWNER && requester.getRole() != MemberRole.ADMIN) {
            throw new AccessDeniedException("Only OWNER or ADMIN can add members");
        }

        if (memberRepository.existsByRoomIdAndUserId(roomId, targetUserId)) {
            throw new DuplicateResourceException("User is already a member of this room");
        }

        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", targetUserId));

        ChatRoomMember member = ChatRoomMember.builder()
                .room(room)
                .user(targetUser)
                .role(MemberRole.MEMBER)
                .build();
        member = memberRepository.save(member);

        log.info("Member added: roomId={}, userId={}, addedBy={}", roomId, targetUserId, requesterId);

        return toMemberResponse(member);
    }

    @Transactional
    public void removeMember(UUID roomId, UUID targetUserId, UUID requesterId) {
        ChatRoomMember requester = memberRepository.findByRoomIdAndUserId(roomId, requesterId)
                .orElseThrow(() -> new AccessDeniedException("You are not a member of this room"));

        if (!targetUserId.equals(requesterId)) {
            if (requester.getRole() != MemberRole.OWNER && requester.getRole() != MemberRole.ADMIN) {
                throw new AccessDeniedException("Only OWNER or ADMIN can remove other members");
            }
        }

        if (!memberRepository.existsByRoomIdAndUserId(roomId, targetUserId)) {
            throw new ResourceNotFoundException("Membership", "userId", targetUserId);
        }

        memberRepository.deleteByRoomIdAndUserId(roomId, targetUserId);
        log.info("Member removed: roomId={}, userId={}, removedBy={}", roomId, targetUserId, requesterId);
    }

    @Transactional
    public ChatRoomResponse getOrCreateDmRoom(UUID userId, UUID targetUserId) {
        if (userId.equals(targetUserId)) {
            throw new IllegalArgumentException("Cannot create a DM with yourself");
        }

        User currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", targetUserId));

        // Check if DM room already exists
        Optional<ChatRoom> existingDm = chatRoomRepository.findDmRoomBetweenUsers(
                RoomType.DM, userId, targetUserId);

        if (existingDm.isPresent()) {
            ChatRoom room = existingDm.get();
            int memberCount = memberRepository.findMembersWithUserByRoomId(room.getId()).size();
            return toResponse(room, memberCount);
        }

        // Create new DM room
        String dmName = currentUser.getUsername() + " & " + targetUser.getUsername();
        ChatRoom room = ChatRoom.builder()
                .name(dmName)
                .type(RoomType.DM)
                .maxMembers(2)
                .createdBy(currentUser)
                .build();
        room = chatRoomRepository.save(room);

        // Add both users
        memberRepository.save(ChatRoomMember.builder()
                .room(room).user(currentUser).role(MemberRole.OWNER).build());
        memberRepository.save(ChatRoomMember.builder()
                .room(room).user(targetUser).role(MemberRole.MEMBER).build());

        log.info("DM room created: id={}, between {} and {}", room.getId(), userId, targetUserId);

        return toResponse(room, 2);
    }

    private ChatRoomResponse toResponse(ChatRoom room, int memberCount) {
        return ChatRoomResponse.builder()
                .id(room.getId())
                .name(room.getName())
                .type(room.getType().name())
                .createdById(room.getCreatedBy().getId())
                .createdByUsername(room.getCreatedBy().getUsername())
                .createdAt(room.getCreatedAt())
                .memberCount(memberCount)
                .maxMembers(room.getMaxMembers())
                .allowedMediaTypes(room.getAllowedMediaTypes())
                .build();
    }

    private MemberResponse toMemberResponse(ChatRoomMember member) {
        return MemberResponse.builder()
                .id(member.getId())
                .userId(member.getUser().getId())
                .username(member.getUser().getUsername())
                .role(member.getRole().name())
                .joinedAt(member.getJoinedAt())
                .build();
    }
}

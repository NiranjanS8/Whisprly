package com.chatapp.service;

import com.chatapp.dto.ChatRoomResponse;
import com.chatapp.dto.MemberResponse;
import com.chatapp.exception.DuplicateResourceException;
import com.chatapp.exception.ResourceNotFoundException;
import com.chatapp.model.ChatRoom;
import com.chatapp.model.ChatRoomMember;
import com.chatapp.model.MemberRole;
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
    public ChatRoomResponse createRoom(String name, UUID creatorId) {
        User creator = userRepository.findById(creatorId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", creatorId));

        ChatRoom room = ChatRoom.builder()
                .name(name)
                .createdBy(creator)
                .build();
        room = chatRoomRepository.save(room);

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

    private ChatRoomResponse toResponse(ChatRoom room, int memberCount) {
        return ChatRoomResponse.builder()
                .id(room.getId())
                .name(room.getName())
                .createdById(room.getCreatedBy().getId())
                .createdByUsername(room.getCreatedBy().getUsername())
                .createdAt(room.getCreatedAt())
                .memberCount(memberCount)
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

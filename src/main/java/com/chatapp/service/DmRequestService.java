package com.chatapp.service;

import com.chatapp.dto.ChatRoomResponse;
import com.chatapp.dto.DmRequestResponse;
import com.chatapp.exception.DuplicateResourceException;
import com.chatapp.exception.ResourceNotFoundException;
import com.chatapp.model.DmRequest;
import com.chatapp.model.DmRequestStatus;
import com.chatapp.model.RoomType;
import com.chatapp.model.User;
import com.chatapp.repository.ChatRoomRepository;
import com.chatapp.repository.DmRequestRepository;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DmRequestService {

    private final DmRequestRepository dmRequestRepository;
    private final UserRepository userRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomService chatRoomService;

    @Transactional
    public DmRequestResponse sendRequest(UUID requesterId, UUID targetUserId) {
        if (requesterId.equals(targetUserId)) {
            throw new IllegalArgumentException("Cannot send a DM request to yourself");
        }

        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", requesterId));
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", targetUserId));

        if (chatRoomRepository.findDmRoomBetweenUsers(RoomType.DM, requesterId, targetUserId).isPresent()) {
            throw new DuplicateResourceException("Direct message room already exists");
        }

        if (dmRequestRepository.findActiveRequest(requesterId, targetUserId, DmRequestStatus.PENDING).isPresent()) {
            throw new DuplicateResourceException("DM request already sent");
        }

        if (dmRequestRepository.findActiveRequest(targetUserId, requesterId, DmRequestStatus.PENDING).isPresent()) {
            throw new DuplicateResourceException("You have a pending DM request from this user");
        }

        DmRequest request = DmRequest.builder()
                .requester(requester)
                .target(target)
                .status(DmRequestStatus.PENDING)
                .build();

        request = dmRequestRepository.save(request);
        log.info("DM request sent: requestId={}, from={}, to={}", request.getId(), requesterId, targetUserId);
        return toResponse(request);
    }

    @Transactional(readOnly = true)
    public List<DmRequestResponse> getIncoming(UUID userId) {
        return dmRequestRepository.findIncomingByTargetUserId(userId, DmRequestStatus.PENDING)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<DmRequestResponse> getSent(UUID userId) {
        return dmRequestRepository.findSentByRequesterId(userId, DmRequestStatus.PENDING)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ChatRoomResponse accept(UUID requestId, UUID currentUserId) {
        DmRequest request = dmRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("DmRequest", "id", requestId));

        if (!request.getTarget().getId().equals(currentUserId)) {
            throw new AccessDeniedException("You cannot accept this request");
        }

        if (request.getStatus() != DmRequestStatus.PENDING) {
            throw new IllegalStateException("Request is not pending");
        }

        request.setStatus(DmRequestStatus.ACCEPTED);
        request.setRespondedAt(Instant.now());
        dmRequestRepository.save(request);

        log.info("DM request accepted: requestId={}, acceptedBy={}", requestId, currentUserId);
        return chatRoomService.getOrCreateDmRoom(request.getRequester().getId(), request.getTarget().getId());
    }

    @Transactional
    public DmRequestResponse reject(UUID requestId, UUID currentUserId) {
        DmRequest request = dmRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("DmRequest", "id", requestId));

        if (!request.getTarget().getId().equals(currentUserId)) {
            throw new AccessDeniedException("You cannot reject this request");
        }

        if (request.getStatus() != DmRequestStatus.PENDING) {
            throw new IllegalStateException("Request is not pending");
        }

        request.setStatus(DmRequestStatus.REJECTED);
        request.setRespondedAt(Instant.now());
        request = dmRequestRepository.save(request);

        log.info("DM request rejected: requestId={}, rejectedBy={}", requestId, currentUserId);
        return toResponse(request);
    }

    private DmRequestResponse toResponse(DmRequest request) {
        return DmRequestResponse.builder()
                .id(request.getId())
                .requesterId(request.getRequester().getId())
                .requesterUsername(request.getRequester().getUsername())
                .targetId(request.getTarget().getId())
                .targetUsername(request.getTarget().getUsername())
                .status(request.getStatus().name())
                .createdAt(request.getCreatedAt())
                .respondedAt(request.getRespondedAt())
                .build();
    }
}

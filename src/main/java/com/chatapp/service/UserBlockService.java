package com.chatapp.service;

import com.chatapp.exception.DuplicateResourceException;
import com.chatapp.exception.ResourceNotFoundException;
import com.chatapp.model.User;
import com.chatapp.model.UserBlock;
import com.chatapp.repository.UserBlockRepository;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserBlockService {

    private final UserBlockRepository userBlockRepository;
    private final UserRepository userRepository;

    @Transactional
    public void blockUser(UUID blockerId, UUID blockedId) {
        if (blockerId.equals(blockedId)) {
            throw new IllegalArgumentException("You cannot block yourself");
        }
        if (userBlockRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId)) {
            throw new DuplicateResourceException("User is already blocked");
        }

        User blocker = userRepository.findById(blockerId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", blockerId));
        User blocked = userRepository.findById(blockedId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", blockedId));

        userBlockRepository.save(UserBlock.builder()
                .blocker(blocker)
                .blocked(blocked)
                .build());
    }

    @Transactional
    public void unblockUser(UUID blockerId, UUID blockedId) {
        userBlockRepository.deleteByBlockerIdAndBlockedId(blockerId, blockedId);
    }

    @Transactional(readOnly = true)
    public boolean isBlockedByCurrentUser(UUID currentUserId, UUID targetUserId) {
        return userBlockRepository.existsByBlockerIdAndBlockedId(currentUserId, targetUserId);
    }

    @Transactional(readOnly = true)
    public boolean hasBlockedCurrentUser(UUID currentUserId, UUID targetUserId) {
        return userBlockRepository.existsByBlockerIdAndBlockedId(targetUserId, currentUserId);
    }

    @Transactional(readOnly = true)
    public boolean existsBlockBetween(UUID userA, UUID userB) {
        return userBlockRepository.existsBlockBetween(userA, userB);
    }
}

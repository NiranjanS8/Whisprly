package com.chatapp.service;

import com.chatapp.exception.DuplicateResourceException;
import com.chatapp.model.User;
import com.chatapp.model.UserBlock;
import com.chatapp.repository.UserBlockRepository;
import com.chatapp.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserBlockServiceTest {

    @Mock
    private UserBlockRepository userBlockRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserBlockService userBlockService;

    @Test
    void blockUserPersistsBlockRelationship() {
        UUID blockerId = UUID.randomUUID();
        UUID blockedId = UUID.randomUUID();
        User blocker = User.builder().id(blockerId).username("alice").build();
        User blocked = User.builder().id(blockedId).username("bob").build();

        when(userBlockRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId)).thenReturn(false);
        when(userRepository.findById(blockerId)).thenReturn(Optional.of(blocker));
        when(userRepository.findById(blockedId)).thenReturn(Optional.of(blocked));

        userBlockService.blockUser(blockerId, blockedId);

        ArgumentCaptor<UserBlock> captor = ArgumentCaptor.forClass(UserBlock.class);
        verify(userBlockRepository).save(captor.capture());
        assertSame(blocker, captor.getValue().getBlocker());
        assertSame(blocked, captor.getValue().getBlocked());
    }

    @Test
    void blockUserRejectsDuplicateBlock() {
        UUID blockerId = UUID.randomUUID();
        UUID blockedId = UUID.randomUUID();

        when(userBlockRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId)).thenReturn(true);

        assertThrows(DuplicateResourceException.class, () -> userBlockService.blockUser(blockerId, blockedId));

        verify(userRepository, never()).findById(any());
        verify(userBlockRepository, never()).save(any());
    }

    @Test
    void blockUserRejectsSelfBlock() {
        UUID userId = UUID.randomUUID();

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> userBlockService.blockUser(userId, userId));

        assertEquals("You cannot block yourself", ex.getMessage());
        verify(userBlockRepository, never()).existsByBlockerIdAndBlockedId(any(), any());
        verify(userBlockRepository, never()).save(any());
    }
}

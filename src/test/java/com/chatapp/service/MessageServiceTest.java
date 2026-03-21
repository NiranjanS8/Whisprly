package com.chatapp.service;

import com.chatapp.model.ChatRoom;
import com.chatapp.model.ChatRoomMember;
import com.chatapp.model.MemberRole;
import com.chatapp.model.Message;
import com.chatapp.model.RoomType;
import com.chatapp.model.User;
import com.chatapp.repository.ChatRoomMemberRepository;
import com.chatapp.repository.ChatRoomRepository;
import com.chatapp.repository.MessageRepository;
import com.chatapp.repository.UserRepository;
import com.chatapp.storage.AttachmentValidationService;
import com.chatapp.storage.StorageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private ChatRoomRepository chatRoomRepository;

    @Mock
    private ChatRoomMemberRepository memberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private StorageService storageService;

    @Mock
    private AttachmentValidationService attachmentValidationService;

    @Mock
    private UserBlockService userBlockService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private MessageService messageService;

    @Test
    void sendMessageRejectsBlockedDirectMessageConversation() {
        UUID roomId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        ChatRoom room = ChatRoom.builder()
                .id(roomId)
                .slug("alice-bob")
                .type(RoomType.DM)
                .membersCanMessage(true)
                .build();
        User sender = User.builder().id(senderId).username("alice").build();
        User recipient = User.builder().id(recipientId).username("bob").build();

        when(chatRoomRepository.findById(roomId)).thenReturn(Optional.of(room));
        when(memberRepository.findByRoomIdAndUserId(roomId, senderId)).thenReturn(Optional.of(
                ChatRoomMember.builder().room(room).user(sender).role(MemberRole.OWNER).build()
        ));
        when(memberRepository.findMembersWithUserByRoomId(roomId)).thenReturn(List.of(
                ChatRoomMember.builder().room(room).user(sender).role(MemberRole.OWNER).build(),
                ChatRoomMember.builder().room(room).user(recipient).role(MemberRole.MEMBER).build()
        ));
        when(userBlockService.existsBlockBetween(senderId, recipientId)).thenReturn(true);

        AccessDeniedException ex = assertThrows(
                AccessDeniedException.class,
                () -> messageService.sendMessage(roomId, senderId, "hello", null)
        );

        assertEquals("Cannot send message due to user block settings", ex.getMessage());
        verify(userRepository, never()).findById(any());
        verify(messageRepository, never()).save(any());
    }

    @Test
    void sendMessageAllowsUnblockedGroupRoomMessageFlowPastValidation() {
        UUID roomId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        ChatRoom room = ChatRoom.builder()
                .id(roomId)
                .slug("general")
                .type(RoomType.GROUP)
                .membersCanMessage(true)
                .build();
        User sender = User.builder().id(senderId).username("alice").build();

        when(chatRoomRepository.findById(roomId)).thenReturn(Optional.of(room));
        when(memberRepository.findByRoomIdAndUserId(roomId, senderId)).thenReturn(Optional.of(
                ChatRoomMember.builder().room(room).user(sender).role(MemberRole.MEMBER).build()
        ));
        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> {
            Message message = invocation.getArgument(0);
            message.setId(UUID.randomUUID());
            message.setSender(sender);
            message.setRoom(room);
            return message;
        });

        assertNotNull(messageService.sendMessage(roomId, senderId, "hello", null));

        verify(userBlockService, never()).existsBlockBetween(any(), any());
    }
}

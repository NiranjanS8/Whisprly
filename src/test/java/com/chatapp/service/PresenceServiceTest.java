package com.chatapp.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.HashMap;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PresenceServiceTest {

    @Mock
    private PresenceStore presenceStore;

    @InjectMocks
    private PresenceService presenceService;

    @Test
    void onSessionConnectRegistersSessionWhenUserIdIsPresent() {
        UUID userId = UUID.randomUUID();
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setSessionId("session-1");
        accessor.setSessionAttributes(new HashMap<>());
        accessor.getSessionAttributes().put("userId", userId);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        presenceService.onSessionConnect(new SessionConnectEvent(this, message));

        verify(presenceStore).registerSession("session-1", userId);
    }

    @Test
    void onSessionConnectIgnoresMissingUserId() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setSessionId("session-1");
        accessor.setSessionAttributes(new HashMap<>());
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        presenceService.onSessionConnect(new SessionConnectEvent(this, message));

        verify(presenceStore, never()).registerSession(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void onSessionDisconnectUnregistersSession() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.DISCONNECT);
        accessor.setSessionId("session-1");
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        presenceService.onSessionDisconnect(new SessionDisconnectEvent(this, message, "session-1", CloseStatus.NORMAL, null));

        verify(presenceStore).unregisterSession("session-1");
    }

    @Test
    void delegatesPresenceQueriesToStore() {
        UUID userId = UUID.randomUUID();
        when(presenceStore.isOnline(userId)).thenReturn(true);
        when(presenceStore.getOnlineUserIds()).thenReturn(Set.of(userId));

        assertEquals(true, presenceService.isOnline(userId));
        assertEquals(Set.of(userId), presenceService.getOnlineUserIds());

        verify(presenceStore).isOnline(userId);
        verify(presenceStore).getOnlineUserIds();
    }
}

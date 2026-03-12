package com.chatapp.listener;

import com.chatapp.dto.RoomUnreadUpdateResponse;
import com.chatapp.event.MessageCreatedEvent;
import com.chatapp.service.ChatRoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class MessageCreatedEventListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final ChatRoomService chatRoomService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMessageCreated(MessageCreatedEvent event) {
        messagingTemplate.convertAndSend("/topic/room/" + event.getRoomSlug(), event.getMessage());

        for (RoomUnreadUpdateResponse unreadUpdate : chatRoomService.getUnreadUpdatesForRoom(event.getRoomId())) {
            if (unreadUpdate.getUserId() == null) {
                continue;
            }
            messagingTemplate.convertAndSendToUser(
                    unreadUpdate.getUserId().toString(),
                    "/queue/rooms/unread",
                    unreadUpdate);
        }
    }
}

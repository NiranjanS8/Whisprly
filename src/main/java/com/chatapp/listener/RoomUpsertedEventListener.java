package com.chatapp.listener;

import com.chatapp.event.RoomUpsertedEvent;
import com.chatapp.service.ChatRoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class RoomUpsertedEventListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final ChatRoomService chatRoomService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRoomUpserted(RoomUpsertedEvent event) {
        for (var userId : event.getRecipientUserIds()) {
            if (userId == null) {
                continue;
            }
            var roomResponse = chatRoomService.getRoomDetails(event.getRoomId(), userId);
            messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/rooms/updates",
                    roomResponse);
        }
    }
}

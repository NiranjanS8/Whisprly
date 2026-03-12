package com.chatapp.listener;

import com.chatapp.event.DmRequestCreatedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class DmRequestCreatedEventListener {

    private final SimpMessagingTemplate messagingTemplate;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDmRequestCreated(DmRequestCreatedEvent event) {
        messagingTemplate.convertAndSendToUser(
                event.getTargetUserId().toString(),
                "/queue/dm-requests/incoming",
                event.getRequest());
    }
}

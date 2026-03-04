package com.chatapp.service;

import com.chatapp.dto.ChatMessageResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class MessageExpirationScheduler {

    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;

    @Scheduled(fixedDelay = 1000)
    public void expireMessages() {
        List<ChatMessageResponse> expiredMessages = messageService.expireDueMessages();
        if (expiredMessages.isEmpty()) {
            return;
        }

        expiredMessages.forEach((message) ->
                messagingTemplate.convertAndSend("/topic/room/" + message.getRoomId(), message));
        log.debug("Expired {} messages", expiredMessages.size());
    }
}

package com.chatapp.service;

import com.chatapp.repository.ChatRoomRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class RoomPublicIdInitializer implements ApplicationRunner {

    private final ChatRoomRepository chatRoomRepository;
    private final RoomPublicIdService roomPublicIdService;

    @Override
    public void run(ApplicationArguments args) {
        chatRoomRepository.findAll().forEach(room -> {
            if (room.getSlug() == null || room.getSlug().isBlank()
                    || room.getInviteCode() == null || room.getInviteCode().isBlank()) {
                roomPublicIdService.ensurePublicIds(room);
                log.info("Backfilled public room identifiers for room {}", room.getId());
            }
        });
    }
}

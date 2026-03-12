package com.chatapp.service;

import com.chatapp.exception.ResourceNotFoundException;
import com.chatapp.model.ChatRoom;
import com.chatapp.repository.ChatRoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RoomPublicIdService {

    private static final String DEFAULT_SLUG = "room";
    private static final String INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int INVITE_CODE_LENGTH = 8;

    private final ChatRoomRepository chatRoomRepository;

    public ChatRoom resolveRoom(String identifier) {
        if (identifier == null || identifier.trim().isEmpty()) {
            throw new ResourceNotFoundException("ChatRoom", "identifier", identifier);
        }

        String normalized = identifier.trim();
        if (isUuid(normalized)) {
            return chatRoomRepository.findById(UUID.fromString(normalized))
                    .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", "id", normalized));
        }

        return chatRoomRepository.findBySlugIgnoreCase(normalized)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", "slug", normalized));
    }

    public ChatRoom resolveRoomByInviteCode(String inviteCode) {
        String normalized = inviteCode == null ? "" : inviteCode.trim();
        return chatRoomRepository.findByInviteCodeIgnoreCase(normalized)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", "inviteCode", normalized));
    }

    public String generateUniqueSlug(String name) {
        String baseSlug = slugify(name);
        String candidate = baseSlug;
        int suffix = 2;
        while (chatRoomRepository.existsBySlug(candidate)) {
            candidate = baseSlug + "-" + suffix;
            suffix++;
        }
        return candidate;
    }

    public String generateUniqueInviteCode() {
        String candidate = randomInviteCode();
        while (chatRoomRepository.existsByInviteCode(candidate)) {
            candidate = randomInviteCode();
        }
        return candidate;
    }

    public void ensurePublicIds(ChatRoom room) {
        boolean changed = false;
        if (room.getSlug() == null || room.getSlug().isBlank()) {
            room.setSlug(generateUniqueSlug(room.getName()));
            changed = true;
        }
        if (room.getInviteCode() == null || room.getInviteCode().isBlank()) {
            room.setInviteCode(generateUniqueInviteCode());
            changed = true;
        }
        if (changed) {
            chatRoomRepository.save(room);
        }
    }

    private String slugify(String value) {
        String normalized = value == null ? "" : Normalizer.normalize(value, Normalizer.Form.NFKD);
        normalized = normalized.replaceAll("[^\\p{ASCII}]", "");
        normalized = normalized.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-+|-+$)", "");
        if (normalized.isBlank()) {
            return DEFAULT_SLUG;
        }
        return normalized.length() > 140 ? normalized.substring(0, 140).replaceAll("-+$", "") : normalized;
    }

    private String randomInviteCode() {
        StringBuilder builder = new StringBuilder(INVITE_CODE_LENGTH);
        for (int index = 0; index < INVITE_CODE_LENGTH; index++) {
            int randomIndex = ThreadLocalRandom.current().nextInt(INVITE_CODE_ALPHABET.length());
            builder.append(INVITE_CODE_ALPHABET.charAt(randomIndex));
        }
        return builder.toString();
    }

    private boolean isUuid(String value) {
        try {
            UUID.fromString(value);
            return true;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }
}

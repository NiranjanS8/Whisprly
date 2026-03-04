package com.chatapp.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "chat_rooms")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private RoomType type = RoomType.GROUP;

    @Column(name = "max_members")
    @Builder.Default
    private Integer maxMembers = 100;

    @Column(name = "allowed_media_types", length = 255)
    @Builder.Default
    private String allowedMediaTypes = "text,image,video,file";

    @Column(name = "avatar_url", length = 1000)
    private String avatarUrl;

    @Column(name = "room_description", length = 500)
    private String description;

    @Column(name = "members_can_message", nullable = false)
    @Builder.Default
    private Boolean membersCanMessage = true;

    @Column(name = "members_can_add_members", nullable = false)
    @Builder.Default
    private Boolean membersCanAddMembers = false;

    @Column(name = "self_destruct_seconds")
    private Integer selfDestructSeconds;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

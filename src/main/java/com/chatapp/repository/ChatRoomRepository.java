package com.chatapp.repository;

import com.chatapp.model.ChatRoom;
import com.chatapp.model.RoomType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, UUID> {

    Optional<ChatRoom> findBySlugIgnoreCase(String slug);

    Optional<ChatRoom> findByInviteCodeIgnoreCase(String inviteCode);

    boolean existsBySlug(String slug);

    boolean existsByInviteCode(String inviteCode);

    @Query("SELECT cr FROM ChatRoom cr JOIN ChatRoomMember m ON m.room = cr WHERE m.user.id = :userId ORDER BY cr.createdAt DESC")
    List<ChatRoom> findRoomsByUserId(@Param("userId") UUID userId);

    @Query("""
            SELECT cr FROM ChatRoom cr
            WHERE cr.type = :type
            AND cr.id IN (SELECT m1.room.id FROM ChatRoomMember m1 WHERE m1.user.id = :userId1)
            AND cr.id IN (SELECT m2.room.id FROM ChatRoomMember m2 WHERE m2.user.id = :userId2)
            """)
    Optional<ChatRoom> findDmRoomBetweenUsers(
            @Param("type") RoomType type,
            @Param("userId1") UUID userId1,
            @Param("userId2") UUID userId2);
}

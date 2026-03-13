package com.chatapp.repository;

import com.chatapp.model.ChatRoomMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChatRoomMemberRepository extends JpaRepository<ChatRoomMember, UUID> {

    boolean existsByRoomIdAndUserId(UUID roomId, UUID userId);

    Optional<ChatRoomMember> findByRoomIdAndUserId(UUID roomId, UUID userId);

    @Query("SELECT m FROM ChatRoomMember m JOIN FETCH m.user WHERE m.room.id = :roomId ORDER BY m.joinedAt")
    List<ChatRoomMember> findMembersWithUserByRoomId(@Param("roomId") UUID roomId);

    @Query("SELECT m FROM ChatRoomMember m JOIN FETCH m.room r JOIN FETCH r.createdBy WHERE m.user.id = :userId")
    List<ChatRoomMember> findMembershipsByUserIdWithRoom(@Param("userId") UUID userId);

    @Query("""
            SELECT COUNT(DISTINCT m1.room.id)
            FROM ChatRoomMember m1
            JOIN ChatRoomMember m2 ON m1.room.id = m2.room.id
            WHERE m1.user.id = :firstUserId
              AND m2.user.id = :secondUserId
            """)
    long countRoomsInCommon(@Param("firstUserId") UUID firstUserId, @Param("secondUserId") UUID secondUserId);

    void deleteByRoomId(UUID roomId);

    void deleteByRoomIdAndUserId(UUID roomId, UUID userId);
}

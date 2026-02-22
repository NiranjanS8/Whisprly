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

    void deleteByRoomIdAndUserId(UUID roomId, UUID userId);
}

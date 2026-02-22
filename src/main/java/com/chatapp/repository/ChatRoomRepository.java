package com.chatapp.repository;

import com.chatapp.model.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, UUID> {

    @Query("SELECT cr FROM ChatRoom cr JOIN ChatRoomMember m ON m.room = cr WHERE m.user.id = :userId ORDER BY cr.createdAt DESC")
    List<ChatRoom> findRoomsByUserId(@Param("userId") UUID userId);
}

package com.chatapp.repository;

import com.chatapp.model.UserBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface UserBlockRepository extends JpaRepository<UserBlock, UUID> {

    @Query("""
            SELECT COUNT(ub) > 0
            FROM UserBlock ub
            WHERE ub.blocker.id = :blockerId
              AND ub.blocked.id = :blockedId
            """)
    boolean existsByBlockerIdAndBlockedId(@Param("blockerId") UUID blockerId, @Param("blockedId") UUID blockedId);

    @Modifying
    @Query("""
            DELETE FROM UserBlock ub
            WHERE ub.blocker.id = :blockerId
              AND ub.blocked.id = :blockedId
            """)
    void deleteByBlockerIdAndBlockedId(@Param("blockerId") UUID blockerId, @Param("blockedId") UUID blockedId);

    @Query("""
            SELECT COUNT(ub) > 0
            FROM UserBlock ub
            WHERE (ub.blocker.id = :userA AND ub.blocked.id = :userB)
               OR (ub.blocker.id = :userB AND ub.blocked.id = :userA)
            """)
    boolean existsBlockBetween(@Param("userA") UUID userA, @Param("userB") UUID userB);
}

package com.chatapp.repository;

import com.chatapp.model.DmRequest;
import com.chatapp.model.DmRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DmRequestRepository extends JpaRepository<DmRequest, UUID> {

    @Query("""
            SELECT r FROM DmRequest r
            WHERE r.requester.id = :requesterId
            AND r.target.id = :targetId
            AND r.status = :status
            """)
    Optional<DmRequest> findActiveRequest(
            @Param("requesterId") UUID requesterId,
            @Param("targetId") UUID targetId,
            @Param("status") DmRequestStatus status);

    @Query("""
            SELECT r FROM DmRequest r
            JOIN FETCH r.requester req
            JOIN FETCH r.target tgt
            WHERE r.target.id = :targetUserId
            AND r.status = :status
            ORDER BY r.createdAt DESC
            """)
    List<DmRequest> findIncomingByTargetUserId(
            @Param("targetUserId") UUID targetUserId,
            @Param("status") DmRequestStatus status);

    @Query("""
            SELECT r FROM DmRequest r
            JOIN FETCH r.requester req
            JOIN FETCH r.target tgt
            WHERE r.requester.id = :requesterId
            AND r.status = :status
            ORDER BY r.createdAt DESC
            """)
    List<DmRequest> findSentByRequesterId(
            @Param("requesterId") UUID requesterId,
            @Param("status") DmRequestStatus status);
}

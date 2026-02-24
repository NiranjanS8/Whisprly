package com.chatapp.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TransferOwnershipRequest {

    @NotNull(message = "New owner user ID is required")
    private UUID newOwnerUserId;
}

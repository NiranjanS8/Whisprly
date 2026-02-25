package com.chatapp.storage;

import com.chatapp.model.AttachmentCategory;

public record ValidatedAttachment(
        String fileName,
        String contentType,
        long sizeBytes,
        AttachmentCategory category
) {
}

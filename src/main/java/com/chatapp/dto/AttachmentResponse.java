package com.chatapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttachmentResponse {
    private String fileName;
    private String contentType;
    private Long fileSizeBytes;
    private String category;
    private String url;
    private Boolean inlinePreviewable;
}

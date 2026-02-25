package com.chatapp.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("chat.attachments")
public class AttachmentProperties {

    private long maxFileSizeBytes = 25L * 1024 * 1024;

    public long getMaxFileSizeBytes() {
        return maxFileSizeBytes;
    }

    public void setMaxFileSizeBytes(long maxFileSizeBytes) {
        this.maxFileSizeBytes = maxFileSizeBytes;
    }
}

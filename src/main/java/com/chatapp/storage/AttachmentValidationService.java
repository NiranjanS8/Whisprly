package com.chatapp.storage;

import com.chatapp.model.AttachmentCategory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class AttachmentValidationService {

    private static final Map<AttachmentCategory, Set<String>> CATEGORY_CONTENT_TYPES = Map.of(
            AttachmentCategory.IMAGE, Set.of(
                    "image/jpeg", "image/png", "image/gif", "image/webp"
            ),
            AttachmentCategory.VIDEO, Set.of(
                    "video/mp4", "video/webm", "video/ogg", "video/quicktime"
            ),
            AttachmentCategory.AUDIO, Set.of(
                    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4"
            ),
            AttachmentCategory.DOCUMENT, Set.of(
                    "application/pdf",
                    "text/plain",
                    "text/csv",
                    "application/msword",
                    "application/vnd.ms-excel",
                    "application/vnd.ms-powerpoint",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            )
    );

    private static final Map<String, AttachmentCategory> EXTENSION_CATEGORY = Map.ofEntries(
            Map.entry("jpg", AttachmentCategory.IMAGE),
            Map.entry("jpeg", AttachmentCategory.IMAGE),
            Map.entry("png", AttachmentCategory.IMAGE),
            Map.entry("gif", AttachmentCategory.IMAGE),
            Map.entry("webp", AttachmentCategory.IMAGE),
            Map.entry("mp4", AttachmentCategory.VIDEO),
            Map.entry("webm", AttachmentCategory.VIDEO),
            Map.entry("mov", AttachmentCategory.VIDEO),
            Map.entry("ogg", AttachmentCategory.VIDEO),
            Map.entry("mp3", AttachmentCategory.AUDIO),
            Map.entry("wav", AttachmentCategory.AUDIO),
            Map.entry("m4a", AttachmentCategory.AUDIO),
            Map.entry("pdf", AttachmentCategory.DOCUMENT),
            Map.entry("txt", AttachmentCategory.DOCUMENT),
            Map.entry("csv", AttachmentCategory.DOCUMENT),
            Map.entry("doc", AttachmentCategory.DOCUMENT),
            Map.entry("docx", AttachmentCategory.DOCUMENT),
            Map.entry("xls", AttachmentCategory.DOCUMENT),
            Map.entry("xlsx", AttachmentCategory.DOCUMENT),
            Map.entry("ppt", AttachmentCategory.DOCUMENT),
            Map.entry("pptx", AttachmentCategory.DOCUMENT)
    );

    private final AttachmentProperties properties;

    public AttachmentValidationService(AttachmentProperties properties) {
        this.properties = properties;
    }

    public ValidatedAttachment validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Attachment file is required");
        }

        long size = file.getSize();
        if (size <= 0) {
            throw new IllegalArgumentException("Attachment file is empty");
        }
        if (size > properties.getMaxFileSizeBytes()) {
            throw new IllegalArgumentException("File exceeds max upload size of " + properties.getMaxFileSizeBytes() + " bytes");
        }

        String fileName = sanitizeFileName(file.getOriginalFilename());
        String extension = extractExtension(fileName);
        String rawContentType = file.getContentType();
        String contentType = rawContentType == null ? "" : rawContentType.toLowerCase(Locale.ROOT).trim();

        AttachmentCategory category = resolveCategory(contentType, extension);
        if (category == null) {
            throw new IllegalArgumentException("Unsupported attachment type");
        }

        Set<String> allowedContentTypes = CATEGORY_CONTENT_TYPES.get(category);
        boolean isGenericContentType = "application/octet-stream".equals(contentType);
        if (!contentType.isEmpty() && !isGenericContentType && !allowedContentTypes.contains(contentType)) {
            throw new IllegalArgumentException("Unsupported content type: " + contentType);
        }

        String persistedContentType = contentType.isEmpty() ? fallbackContentType(category) : contentType;
        return new ValidatedAttachment(fileName, persistedContentType, size, category);
    }

    private AttachmentCategory resolveCategory(String contentType, String extension) {
        if (!contentType.isEmpty()) {
            for (Map.Entry<AttachmentCategory, Set<String>> entry : CATEGORY_CONTENT_TYPES.entrySet()) {
                if (entry.getValue().contains(contentType)) {
                    return entry.getKey();
                }
            }
        }
        return EXTENSION_CATEGORY.get(extension);
    }

    private String fallbackContentType(AttachmentCategory category) {
        return switch (category) {
            case IMAGE -> "image/jpeg";
            case VIDEO -> "video/mp4";
            case AUDIO -> "audio/mpeg";
            case DOCUMENT -> "application/octet-stream";
        };
    }

    private String sanitizeFileName(String originalName) {
        String cleaned = StringUtils.cleanPath(originalName == null ? "" : originalName.trim());
        if (cleaned.isBlank()) {
            throw new IllegalArgumentException("Attachment file name is invalid");
        }
        if (cleaned.contains("..") || cleaned.contains("/") || cleaned.contains("\\")) {
            throw new IllegalArgumentException("Attachment file name is invalid");
        }
        return cleaned;
    }

    private String extractExtension(String fileName) {
        int idx = fileName.lastIndexOf('.');
        if (idx <= 0 || idx >= fileName.length() - 1) {
            return "";
        }
        return fileName.substring(idx + 1).toLowerCase(Locale.ROOT);
    }
}

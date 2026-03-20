package com.chatapp.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DotenvLoader {

    private DotenvLoader() {
    }

    public static Map<String, Object> loadDefaults(Path path) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (path == null || !Files.exists(path) || !Files.isRegularFile(path)) {
            return values;
        }

        try {
            List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
            for (String rawLine : lines) {
                String line = rawLine == null ? "" : rawLine.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }

                int separatorIndex = line.indexOf('=');
                if (separatorIndex <= 0) {
                    continue;
                }

                String key = line.substring(0, separatorIndex).trim();
                String value = line.substring(separatorIndex + 1).trim();
                if (key.isEmpty() || System.getenv(key) != null) {
                    continue;
                }

                values.put(key, stripQuotes(value));
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to read .env file from " + path.toAbsolutePath(), ex);
        }

        return values;
    }

    private static String stripQuotes(String value) {
        if (value.length() >= 2) {
            boolean doubleQuoted = value.startsWith("\"") && value.endsWith("\"");
            boolean singleQuoted = value.startsWith("'") && value.endsWith("'");
            if (doubleQuoted || singleQuoted) {
                return value.substring(1, value.length() - 1);
            }
        }
        return value;
    }
}

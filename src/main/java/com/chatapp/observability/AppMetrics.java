package com.chatapp.observability;

import com.chatapp.service.PresenceStore;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

@Component
public class AppMetrics {

    private final Counter authRegistrations;
    private final Counter authLogins;
    private final Counter authGoogleLogins;
    private final Counter authRefreshRotations;
    private final Counter authLogouts;
    private final Counter presenceConnects;
    private final Counter presenceDisconnects;
    private final Counter messagesSent;

    public AppMetrics(MeterRegistry meterRegistry, PresenceStore presenceStore) {
        this.authRegistrations = Counter.builder("whisprly.auth.registrations")
                .description("Number of successful user registrations")
                .register(meterRegistry);
        this.authLogins = Counter.builder("whisprly.auth.logins")
                .description("Number of successful username or email logins")
                .register(meterRegistry);
        this.authGoogleLogins = Counter.builder("whisprly.auth.google_logins")
                .description("Number of successful Google sign-ins")
                .register(meterRegistry);
        this.authRefreshRotations = Counter.builder("whisprly.auth.refresh_rotations")
                .description("Number of refresh token rotations")
                .register(meterRegistry);
        this.authLogouts = Counter.builder("whisprly.auth.logouts")
                .description("Number of logout requests that revoked a refresh token")
                .register(meterRegistry);
        this.presenceConnects = Counter.builder("whisprly.presence.connects")
                .description("Number of websocket presence connect events")
                .register(meterRegistry);
        this.presenceDisconnects = Counter.builder("whisprly.presence.disconnects")
                .description("Number of websocket presence disconnect events")
                .register(meterRegistry);
        this.messagesSent = Counter.builder("whisprly.messages.sent")
                .description("Number of chat messages sent")
                .register(meterRegistry);

        Gauge.builder("whisprly.presence.online_users", presenceStore, store -> store.getOnlineUserIds().size())
                .description("Current number of online users tracked by the presence store")
                .register(meterRegistry);
    }

    public void recordRegistration() {
        authRegistrations.increment();
    }

    public void recordLogin() {
        authLogins.increment();
    }

    public void recordGoogleLogin() {
        authGoogleLogins.increment();
    }

    public void recordRefreshRotation() {
        authRefreshRotations.increment();
    }

    public void recordLogout() {
        authLogouts.increment();
    }

    public void recordPresenceConnect() {
        presenceConnects.increment();
    }

    public void recordPresenceDisconnect() {
        presenceDisconnects.increment();
    }

    public void recordMessageSent() {
        messagesSent.increment();
    }
}

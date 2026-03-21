package com.chatapp.security;

import com.chatapp.model.User;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        String normalizedIdentifier = identifier == null ? "" : identifier.trim();
        return userRepository.findByUsernameIgnoreCase(normalizedIdentifier)
                .or(() -> userRepository.findByEmailIgnoreCase(normalizedIdentifier))
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + normalizedIdentifier));
    }

    public User loadUserById(java.util.UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with id: " + userId));
    }
}

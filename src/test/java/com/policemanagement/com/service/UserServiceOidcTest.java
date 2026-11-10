package com.policemanagement.com.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.policemanagement.com.domain.User;
import com.policemanagement.com.repository.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class UserServiceOidcTest {

    @Test
    void acceptsAuthenticatedIdentityWithoutEmailAndDoesNotInventAnEmail() {
        var repository = mock(UserRepository.class);
        var authorities = mock(AuthorityRepository.class);
        when(authorities.findAll()).thenReturn(List.of());
        when(repository.findOneByLogin("new-officer")).thenReturn(Optional.empty());
        var caches = new ConcurrentMapCacheManager(UserRepository.USERS_BY_LOGIN_CACHE, UserRepository.USERS_BY_EMAIL_CACHE);
        var service = new UserService(repository, authorities, caches);
        var jwt = Jwt.withTokenValue("test")
            .header("alg", "RS256")
            .subject("37f3d457-c2cb-49a2-a180-1d06811a9a6d")
            .claim("preferred_username", "new-officer")
            .claim("email_verified", false)
            .build();
        var account = service.getUserFromAuthentication(new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        assertThat(account.isActivated()).isTrue();
        assertThat(account.getEmail()).isNull();
        var saved = ArgumentCaptor.forClass(User.class);
        verify(repository).save(saved.capture());
        try (var validator = jakarta.validation.Validation.buildDefaultValidatorFactory()) {
            assertThat(validator.getValidator().validate(saved.getValue())).isEmpty();
        }
    }
}

package com.policemanagement.com.service.rbac;

import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

/** Server-only administration client. Never returns administrative tokens to callers. */
@Component
public class KeycloakAdminClient {

    private final RestTemplate http;
    private final String issuer, client, secret;
    private String cachedToken;
    private long tokenExpiresAt;
    public static final Map<String, String> ROLES = Map.of(
        "officer",
        "ROLE_USER",
        "sub-admin",
        "ROLE_SUB_ADMIN",
        "admin",
        "ROLE_ADMIN",
        "superadmin",
        "ROLE_SUPERADMIN"
    );

    public KeycloakAdminClient(
        @Value("${spring.security.oauth2.client.provider.oidc.issuer-uri}") String issuer,
        @Value("${rbac.keycloak.client-id:rbac-admin}") String client,
        @Value("${rbac.keycloak.client-secret:}") String secret
    ) {
        this.issuer = issuer.replaceAll("/$", "");
        this.client = client;
        this.secret = secret;
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(10000);
        this.http = new RestTemplate(factory);
    }

    @SuppressWarnings("unchecked")
    public <T> T request(HttpMethod method, String path, Object body, Class<T> type) {
        if (secret.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Chưa cấu hình kết nối quản trị Keycloak");
        try {
            var headers = new HttpHeaders();
            headers.setBearerAuth(accessToken());
            headers.setContentType(MediaType.APPLICATION_JSON);
            String admin = issuer.replace("/realms/", "/admin/realms/");
            return http.exchange(admin + path, method, new HttpEntity<>(body, headers), type).getBody();
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 409) throw new ResponseStatusException(HttpStatus.CONFLICT, "Tài khoản/email đã tồn tại");
            if (ex.getStatusCode().value() == 404) throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Không tìm thấy tài khoản Keycloak"
            );
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Keycloak từ chối thao tác quản trị");
        } catch (org.springframework.web.client.ResourceAccessException ex) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Không kết nối được Keycloak");
        }
    }

    private synchronized String accessToken() {
        if (cachedToken != null && System.currentTimeMillis() < tokenExpiresAt) return cachedToken;
        var form = new LinkedMultiValueMap<String, String>();
        form.add("grant_type", "client_credentials");
        form.add("client_id", client);
        form.add("client_secret", secret);
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        var token = http.postForObject(issuer + "/protocol/openid-connect/token", new HttpEntity<>(form, headers), Map.class);
        cachedToken = (String) token.get("access_token");
        tokenExpiresAt = System.currentTimeMillis() + Math.max(1, ((Number) token.get("expires_in")).longValue() - 30) * 1000;
        return cachedToken;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> user(String id) {
        return request(HttpMethod.GET, "/users/" + UUID.fromString(id), null, Map.class);
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> users() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (int first = 0; ; first += 100) {
            List<Map<String, Object>> page = request(HttpMethod.GET, "/users?first=" + first + "&max=100", null, List.class);
            result.addAll(page);
            if (page.size() < 100) return result;
        }
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> effectiveRoles(String id) {
        return request(HttpMethod.GET, "/users/" + UUID.fromString(id) + "/role-mappings/realm/composite", null, List.class);
    }

    public String role(String id) {
        var names = effectiveRoles(id)
            .stream()
            .map(r -> r.get("name"))
            .toList();
        for (String role : List.of("superadmin", "admin", "sub-admin", "officer")) if (names.contains(ROLES.get(role))) return role;
        return "none";
    }

    @SuppressWarnings("unchecked")
    public void setRole(String id, String role) {
        if (!ROLES.containsKey(role)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vai trò không hợp lệ");
        List<Map<String, Object>> direct = request(HttpMethod.GET, "/users/" + id + "/role-mappings/realm", null, List.class);
        var remove = direct
            .stream()
            .filter(r -> ROLES.containsValue(r.get("name")))
            .toList();
        if (!remove.isEmpty()) request(HttpMethod.DELETE, "/users/" + id + "/role-mappings/realm", remove, Void.class);
        List<Map<String, Object>> add = new ArrayList<>();
        for (String name : role.equals("superadmin")
            ? List.of("ROLE_USER", "ROLE_ADMIN", "ROLE_SUPERADMIN")
            : List.of("ROLE_USER", ROLES.get(role)).stream().distinct().toList()) {
            add.add(request(HttpMethod.GET, "/roles/" + name, null, Map.class));
        }
        request(HttpMethod.POST, "/users/" + id + "/role-mappings/realm", add, Void.class);
        // Group/composite grants must be removed explicitly; otherwise fail and keep the user disabled.
        if (!role.equals(role(id))) throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "Nhóm Keycloak còn cấp vai trò khác. Điều chỉnh Role mapping của nhóm rồi thử lại."
        );
    }

    public void enabled(String id, boolean enabled) {
        request(HttpMethod.PUT, "/users/" + id, Map.of("enabled", enabled), Void.class);
    }

    public void logout(String id) {
        request(HttpMethod.POST, "/users/" + id + "/logout", null, Void.class);
    }
}

package com.policemanagement.com.config;

import com.policemanagement.com.service.rbac.RbacService;
import jakarta.servlet.http.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class RbacWebConfiguration implements WebMvcConfigurer {

    private final RbacService rbac;
    private final boolean whitelist;

    public RbacWebConfiguration(RbacService rbac, @Value("${rbac.email-whitelist-enabled:false}") boolean whitelist) {
        this.rbac = rbac;
        this.whitelist = whitelist;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry
            .addInterceptor(
                new HandlerInterceptor() {
                    @Override
                    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                        // Only completion of an already authorized SSE request; initial requests use every check below.
                        if (
                            request.getDispatcherType() == jakarta.servlet.DispatcherType.ASYNC &&
                            request.getServletPath().equals("/api/rbac/events")
                        ) return true;
                        String ip = request.getRemoteAddr();
                        if (
                            rbac
                                .settings("blacklist")
                                .stream()
                                .anyMatch(entry -> Objects.equals(ip, entry.get("ipAddress")) && "blocked".equals(entry.get("status")))
                        ) throw new AccessDeniedException("IP bị chặn");
                        String path = request.getRequestURI();
                        if (
                            Set.of(
                                "/api/authenticate",
                                "/api/auth-info",
                                "/api/logout",
                                "/management/health",
                                "/management/info",
                                "/management/prometheus"
                            ).contains(path) ||
                            path.startsWith("/management/health/")
                        ) return true;
                        var user = rbac.current();
                        if (
                            (whitelist ||
                                rbac
                                    .settings("policy")
                                    .stream()
                                    .anyMatch(entry -> Boolean.TRUE.equals(entry.get("emailWhitelistEnabled")))) &&
                            !"superadmin".equals(user.get("role")) &&
                            rbac
                                .settings("whitelist")
                                .stream()
                                .noneMatch(
                                    entry ->
                                        "active".equals(entry.get("status")) &&
                                        Objects.toString(user.get("email"), "").equalsIgnoreCase(Objects.toString(entry.get("email"), ""))
                                )
                        ) throw new AccessDeniedException("Email chưa được cấp phép");
                        if (
                            path.startsWith("/api/admin/") ||
                            path.equals("/api/authorities") ||
                            path.startsWith("/management/") ||
                            path.startsWith("/v3/api-docs")
                        ) {
                            if (!List.of("admin", "superadmin").contains(user.get("role"))) throw new AccessDeniedException(
                                "Quyền quản trị đã bị thu hồi"
                            );
                        }
                        return true;
                    }
                }
            )
            .addPathPatterns("/api/**", "/management/**", "/v3/api-docs/**");
    }
}

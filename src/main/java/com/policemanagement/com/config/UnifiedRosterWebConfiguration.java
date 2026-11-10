package com.policemanagement.com.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Legacy read APIs remain available to GIS; all writes use the versioned, audited workflow. */
@Configuration
public class UnifiedRosterWebConfiguration implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry
            .addInterceptor(
                new HandlerInterceptor() {
                    @Override
                    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
                        if (java.util.Set.of("GET", "HEAD", "OPTIONS").contains(request.getMethod())) return true;
                        response.setStatus(409);
                        response.setContentType("application/json;charset=UTF-8");
                        response
                            .getWriter()
                            .write(
                                "{\"message\":\"Dùng menu Danh sách hộ dân / Quản lý nhân khẩu để lưu nguồn và lịch sử; không sửa hoặc xóa qua API cũ.\"}"
                            );
                        return false;
                    }
                }
            )
            .addPathPatterns("/api/households", "/api/households/**", "/api/residents", "/api/residents/**");
    }
}

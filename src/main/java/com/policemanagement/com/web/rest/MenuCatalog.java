package com.policemanagement.com.web.rest;

import com.policemanagement.com.service.rbac.RbacService;
import java.util.*;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class MenuCatalog {

    public static final Set<String> IDS = Set.of(
        "overview",
        "area-map",
        "advanced-map",
        "field-3d-map",
        "households",
        "residents",
        "documents",
        "areas",
        "logs",
        "subadmin-delegation",
        "superadmin-hub",
        "settings"
    );
    private final RbacService rbac;

    public MenuCatalog(RbacService rbac) {
        this.rbac = rbac;
    }

    @org.springframework.transaction.annotation.Transactional
    @EventListener(ApplicationReadyEvent.class)
    public void initialize() {
        var labels = Map.ofEntries(
            Map.entry("overview", "Tổng quan & Thống kê"),
            Map.entry("area-map", "Bản đồ số hóa khu vực"),
            Map.entry("advanced-map", "Bản đồ lưới chuyên sâu"),
            Map.entry("field-3d-map", "Bản Đồ Không Gian 3D Thực Địa"),
            Map.entry("households", "Danh sách hộ dân"),
            Map.entry("residents", "Quản lý nhân khẩu"),
            Map.entry("documents", "Quản lý giấy tờ & ANTT"),
            Map.entry("areas", "Quản lý khu vực & Tuyến"),
            Map.entry("logs", "Nhật ký thao tác"),
            Map.entry("subadmin-delegation", "Phân quyền Cán bộ & CAV"),
            Map.entry("superadmin-hub", "Trung tâm Quản trị Tối cao"),
            Map.entry("settings", "Cài đặt & Tài khoản")
        );
        for (String id : List.of(
            "overview",
            "area-map",
            "advanced-map",
            "field-3d-map",
            "households",
            "residents",
            "documents",
            "areas",
            "logs",
            "subadmin-delegation",
            "superadmin-hub",
            "settings"
        )) {
            List<String> roles = id.equals("superadmin-hub")
                ? List.of("superadmin")
                : Set.of("subadmin-delegation", "areas").contains(id)
                  ? List.of("superadmin", "admin", "sub-admin")
                  : List.of("superadmin", "admin", "sub-admin", "officer");
            Map<String, Object> menu = new LinkedHashMap<>(
                Map.of("id", id, "label", labels.get(id), "description", "", "iconName", "Shield", "visibleRoles", roles)
            );
            rbac.database().update(
                "insert into rbac_setting(kind,id,data) values ('menus',?,?) on conflict(kind,id) do nothing",
                id,
                rbac.encode(menu)
            );
        }
    }
}

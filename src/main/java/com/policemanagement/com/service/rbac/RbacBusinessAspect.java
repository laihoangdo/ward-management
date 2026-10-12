package com.policemanagement.com.service.rbac;

import com.policemanagement.com.service.dto.*;
import java.util.*;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Protects direct service access as well as REST, with metadata/audit in the same transaction. */
@Aspect
@Component
public class RbacBusinessAspect {

    private final RbacService rbac;
    private final TransactionTemplate transaction;

    public RbacBusinessAspect(RbacService rbac, PlatformTransactionManager manager) {
        this.rbac = rbac;
        this.transaction = new TransactionTemplate(manager);
    }

    @Around(
        "execution(* com.policemanagement.com.service.impl.HouseholdServiceImpl.*(..)) || execution(* com.policemanagement.com.service.impl.ResidentServiceImpl.*(..)) || execution(* com.policemanagement.com.service.impl.HamletServiceImpl.*(..)) || execution(* com.policemanagement.com.service.impl.DocumentRecordServiceImpl.*(..)) || execution(* com.policemanagement.com.service.impl.SecurityAlertServiceImpl.*(..)) || execution(* com.policemanagement.com.service.impl.PatrolLogServiceImpl.*(..))"
    )
    public Object protect(ProceedingJoinPoint point) {
        return transaction.execute(status -> {
            String name = point.getSignature().getName();
            Object[] args = point.getArgs();
            String entity = point.getTarget().getClass().getSimpleName().replace("ServiceImpl", "");
            boolean write = Set.of("save", "update", "partialUpdate", "delete").contains(name);
            boolean create = name.equals("save");
            Long id = null;
            Object dto = args.length == 0 ? null : args[0];
            if (dto instanceof Long value) id = value;
            else if (dto != null && write) {
                var data = rbac.decode(rbac.encode(dto));
                if (data.get("id") instanceof Number value) id = value.longValue();
            }
            rbac.current();
            if (entity.equals("Household")) {
                if (id != null) rbac.household(id);
                if (dto instanceof HouseholdDTO household && write) {
                    Long newArea = household.getHamletId();
                    if (create || !name.equals("partialUpdate") || newArea != null) rbac.area(newArea);
                    if (create) {
                        rbac.permission("canAddHouseholds");
                        var streets = (List<?>) rbac.current().getOrDefault("assignedStreets", List.of());
                        if (
                            !rbac.global() &&
                            !streets.isEmpty() &&
                            !streets.contains(household.getStreet()) &&
                            !streets.contains(household.getAlley())
                        ) throw new AccessDeniedException("Tuyến đường ngoài phạm vi được phân công");
                    } else {
                        var old = rbac.database().queryForMap("select * from household where id=?", id);
                        if (
                            ((!name.equals("partialUpdate") || household.getLatitude() != null) &&
                                !Objects.equals(household.getLatitude(), old.get("latitude"))) ||
                            ((!name.equals("partialUpdate") || household.getLongitude() != null) &&
                                !Objects.equals(household.getLongitude(), old.get("longitude")))
                        ) rbac.permission("canEditCoordinates");
                        Map<String, Object> values = rbac.decode(rbac.encode(household));
                        boolean changed = values
                            .entrySet()
                            .stream()
                            .anyMatch(entry -> {
                                if (
                                    (name.equals("partialUpdate") && entry.getValue() == null) ||
                                    Set.of("id", "latitude", "longitude", "administrativeHamlet").contains(entry.getKey())
                                ) return false;
                                String column = entry.getKey().replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase(java.util.Locale.ROOT);
                                return !Objects.equals(entry.getValue(), old.get(column));
                            });
                        if (changed || (newArea != null && !Objects.equals(newArea, old.get("hamlet_id")))) rbac.permission(
                            "canUpdateInspection"
                        );
                        var streets = (List<?>) rbac.current().getOrDefault("assignedStreets", List.of());
                        Object street = household.getStreet() == null ? old.get("street") : household.getStreet();
                        Object alley = household.getAlley() == null ? old.get("alley") : household.getAlley();
                        if (
                            !rbac.global() && !streets.isEmpty() && !streets.contains(street) && !streets.contains(alley)
                        ) throw new AccessDeniedException("Không chuyển hộ sang tuyến ngoài phạm vi");
                    }
                }
            } else if (entity.equals("Resident")) {
                if (id != null) {
                    var rows = rbac.database().queryForList("select household_id from resident where id=?", Long.class, id);
                    if (rows.isEmpty()) throw new AccessDeniedException("Không tìm thấy nhân khẩu được phép");
                    rbac.household(rows.getFirst());
                }
                if (dto instanceof ResidentDTO resident && write) {
                    if (create || !name.equals("partialUpdate") || resident.getHousehold() != null) rbac.household(
                        resident.getHousehold() == null ? null : resident.getHousehold().getId()
                    );
                    rbac.permission("canUpdateInspection");
                }
            } else if (entity.equals("Hamlet")) {
                if (id != null) rbac.area(id);
                if (write) rbac.permission("canManageStreets");
                if (create) rbac.superadmin();
            } else {
                String kind = kind(entity);
                if (id != null) rbac.record(kind, id);
                if (write) {
                    if (name.equals("delete") && !Set.of("Household", "Resident", "Hamlet").contains(entity)) rbac.database().update(
                        "delete from rbac_record_scope where kind=? and record_id=?",
                        kind(entity),
                        id
                    );
                    if (entity.equals("PatrolLog") && !create) throw new AccessDeniedException("Nhật ký công tác không được sửa/xóa");
                    rbac.permission(entity.equals("DocumentRecord") ? "canRenewDocs" : "canUpdateInspection");
                    if (dto instanceof DocumentRecordDTO document && Boolean.TRUE.equals(document.getReminderSent())) rbac.permission(
                        "canSendReminders"
                    );
                    if (!rbac.global() && rbac.areas().isEmpty()) throw new AccessDeniedException("Chưa có phân công địa bàn");
                    if (dto instanceof PatrolLogDTO log) {
                        log.setOfficerName((String) rbac.current().get("fullName"));
                        log.setBadgeNumber((String) rbac.current().get("badgeNumber"));
                        log.setTimestamp(java.time.Instant.now());
                        log.setIpAddress(null);
                    }
                }
            }
            if (name.equals("delete") && !rbac.supervisor()) throw new AccessDeniedException("Không có quyền xóa hồ sơ");
            try {
                Object result = point.proceed();
                if (write) {
                    if (create && result != null && !Set.of("Household", "Resident", "Hamlet").contains(entity)) {
                        var map = rbac.decode(rbac.encode(result));
                        rbac.recordCreated(kind(entity), ((Number) map.get("id")).longValue());
                    }
                    rbac.audit(entity + ":" + name, Objects.toString(id, "new"), Map.of("entity", entity));
                }
                return result;
            } catch (RuntimeException ex) {
                throw ex;
            } catch (Throwable ex) {
                throw new IllegalStateException(ex);
            }
        });
    }

    private String kind(String entity) {
        return Map.of("DocumentRecord", "document", "SecurityAlert", "alert", "PatrolLog", "patrol").get(entity);
    }
}

package com.policemanagement.com.web.rest;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.doReturn;

import com.policemanagement.com.service.rbac.RbacService;
import java.util.Map;
import org.springframework.data.jpa.domain.Specification;

/**
 * Entity REST integration tests run as a commune-wide (superadmin) reader.
 *
 * <p>{@code @WithMockUser} is not an OIDC/JWT session, so the real {@link RbacService#subject()} denies every request, and
 * the denial audit then waits for a second connection that the single-connection test pool never frees. Territory and
 * permission rules are covered by the dedicated RBAC tests; these suites exercise the entity API, so they spy the
 * service and grant a global scope.
 */
public final class RbacTestSupport {

    static final String SUBJECT = "integration-test";

    private RbacTestSupport() {}

    public static void communeWide(RbacService rbac) {
        doReturn(SUBJECT).when(rbac).subject();
        doReturn(Map.of("id", SUBJECT, "role", "superadmin", "status", "active", "fullName", "Cán bộ kiểm thử", "badgeNumber", "IT-0"))
            .when(rbac)
            .current();
        doReturn(true).when(rbac).global();
        doReturn(unrestricted()).when(rbac).householdScope(anyBoolean());
        doReturn(unrestricted()).when(rbac).recordScope(any());
    }

    public static <T> Specification<T> unrestricted() {
        return (root, query, cb) -> cb.conjunction();
    }
}

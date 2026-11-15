package com.policemanagement.com.service;

import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

/** Opening a subject or establishment writes rbac_audit, which PostgreSQL refuses inside a read-only transaction. */
class AuditedReadTransactionTest {

    @Test
    void auditedDetailsRunInWritableTransactions() throws Exception {
        for (Class<?> type : new Class<?>[] {
            com.policemanagement.com.service.subject.SubjectService.class,
            com.policemanagement.com.service.facility.FacilityService.class,
        }) {
            var method = type.getMethod("detail", UUID.class);
            var tx = method.getAnnotation(Transactional.class);
            assertFalse(tx != null && tx.readOnly(), type.getSimpleName() + ".detail must not be read-only");
        }
    }
}

package com.policemanagement.com.web.rest.errors;

import com.policemanagement.com.service.rbac.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.annotation.Order;
import org.springframework.http.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
@Order(-1)
public class RbacExceptionAdvice {

    private final RbacService rbac;
    private final RbacFailureAudit audit;

    public RbacExceptionAdvice(RbacService rbac, RbacFailureAudit audit) {
        this.rbac = rbac;
        this.audit = audit;
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ProblemDetail> denied(AccessDeniedException error, HttpServletRequest request) {
        String actor;
        try {
            actor = rbac.subject();
        } catch (AccessDeniedException ex) {
            actor = "anonymous";
        }
        audit.record(actor, "access-denied", request.getMethod() + " " + request.getRequestURI());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, error.getMessage()));
    }
}

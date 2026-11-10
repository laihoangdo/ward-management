package com.policemanagement.com.service.rbac;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class RbacFailureAudit {

    private final JdbcTemplate db;

    public RbacFailureAudit(JdbcTemplate db) {
        this.db = db;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String actor, String action, String target) {
        db.update("insert into rbac_audit(actor,action,target,details) values (?,?,?,'{}')", actor, action, target);
    }
}

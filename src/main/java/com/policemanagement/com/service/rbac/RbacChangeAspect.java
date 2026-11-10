package com.policemanagement.com.service.rbac;

import java.util.*;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** Runs outside service transactions; an enclosing REST transaction defers notification until commit. */
@Aspect
@Component
@Order(100)
public class RbacChangeAspect {

    private final RbacEventHub events;

    public RbacChangeAspect(RbacEventHub events) {
        this.events = events;
    }

    @Around(
        "execution(* com.policemanagement.com.service.rbac.RbacService.save*(..)) || execution(* com.policemanagement.com.service.rbac.RbacService.updateOwnAccount(..)) || execution(* com.policemanagement.com.service.rbac.RbacService.deleteUser(..)) || execution(* com.policemanagement.com.service.rbac.RbacService.deleteSetting(..)) || execution(* com.policemanagement.com.service.impl.HamletServiceImpl.save(..)) || execution(* com.policemanagement.com.service.impl.HamletServiceImpl.update(..)) || execution(* com.policemanagement.com.service.impl.HamletServiceImpl.partialUpdate(..)) || execution(* com.policemanagement.com.service.impl.HamletServiceImpl.delete(..)) || execution(* com.policemanagement.com.service.rbac.RbacFailureAudit.record(..))"
    )
    public Object changed(ProceedingJoinPoint point) throws Throwable {
        Object result = point.proceed();
        if (result instanceof Optional<?> optional && optional.isEmpty()) return result;
        String method = point.getSignature().getName();
        Object[] args = point.getArgs();
        if (point.getTarget() instanceof RbacFailureAudit) {
            // Identity-provider writes cannot roll back with SQL. Revalidate a fail-closed account
            // after the independent failure audit commits, even if the outer SQL transaction rolls back.
            if ("identity-sync-failed-disabled".equals(args[1])) events.publish(
                new RbacEventHub.Change(args[2].toString(), Set.of("me", "users"), null, true)
            );
        } else if (point.getTarget() instanceof RbacService) {
            if (Set.of("saveSetting", "deleteSetting").contains(method)) {
                String kind = args[0].toString();
                events.afterCommit(
                    new RbacEventHub.Change(
                        null,
                        Set.of("policy", "whitelist", "blacklist").contains(kind) ? Set.of(kind, "me") : Set.of(kind),
                        null,
                        false
                    )
                );
            } else {
                Map<?, ?> saved = result instanceof Map<?, ?> map ? map : Map.of();
                String id = Objects.toString(saved.get("id"), args.length > 0 ? Objects.toString(args[0]) : "");
                Long version = saved.get("version") instanceof Number value ? value.longValue() : null;
                events.afterCommit(new RbacEventHub.Change(id, Set.of("me", "users"), version, true));
            }
        } else {
            // Territory updates can affect loaded records without changing a profile version.
            events.afterCommit(new RbacEventHub.Change(null, Set.of("me", "units"), null, true));
        }
        return result;
    }
}

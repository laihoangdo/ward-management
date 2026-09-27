package com.policemanagement.com.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class SecurityAlertTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + 2L * Integer.MAX_VALUE);

    public static SecurityAlert getSecurityAlertSample1() {
        return new SecurityAlert().id(1L).alertType("alertType1").title("title1").location("location1");
    }

    public static SecurityAlert getSecurityAlertSample2() {
        return new SecurityAlert().id(2L).alertType("alertType2").title("title2").location("location2");
    }

    public static SecurityAlert getSecurityAlertRandomSampleGenerator() {
        return new SecurityAlert()
            .id(longCount.incrementAndGet())
            .alertType(UUID.randomUUID().toString())
            .title(UUID.randomUUID().toString())
            .location(UUID.randomUUID().toString());
    }
}

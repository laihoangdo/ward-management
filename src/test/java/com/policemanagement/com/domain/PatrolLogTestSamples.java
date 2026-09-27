package com.policemanagement.com.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class PatrolLogTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + 2L * Integer.MAX_VALUE);

    public static PatrolLog getPatrolLogSample1() {
        return new PatrolLog()
            .id(1L)
            .action("action1")
            .target("target1")
            .officerName("officerName1")
            .badgeNumber("badgeNumber1")
            .ipAddress("ipAddress1");
    }

    public static PatrolLog getPatrolLogSample2() {
        return new PatrolLog()
            .id(2L)
            .action("action2")
            .target("target2")
            .officerName("officerName2")
            .badgeNumber("badgeNumber2")
            .ipAddress("ipAddress2");
    }

    public static PatrolLog getPatrolLogRandomSampleGenerator() {
        return new PatrolLog()
            .id(longCount.incrementAndGet())
            .action(UUID.randomUUID().toString())
            .target(UUID.randomUUID().toString())
            .officerName(UUID.randomUUID().toString())
            .badgeNumber(UUID.randomUUID().toString())
            .ipAddress(UUID.randomUUID().toString());
    }
}

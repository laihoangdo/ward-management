package com.policemanagement.com.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class AreaZoneTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + 2L * Integer.MAX_VALUE);
    private static final AtomicInteger intCount = new AtomicInteger(random.nextInt() + 2 * Short.MAX_VALUE);

    public static AreaZone getAreaZoneSample1() {
        return new AreaZone()
            .id(1L)
            .code("code1")
            .name("name1")
            .hamletName("hamletName1")
            .officerInCharge("officerInCharge1")
            .officerPhone("officerPhone1")
            .populationCount(1)
            .householdCount(1);
    }

    public static AreaZone getAreaZoneSample2() {
        return new AreaZone()
            .id(2L)
            .code("code2")
            .name("name2")
            .hamletName("hamletName2")
            .officerInCharge("officerInCharge2")
            .officerPhone("officerPhone2")
            .populationCount(2)
            .householdCount(2);
    }

    public static AreaZone getAreaZoneRandomSampleGenerator() {
        return new AreaZone()
            .id(longCount.incrementAndGet())
            .code(UUID.randomUUID().toString())
            .name(UUID.randomUUID().toString())
            .hamletName(UUID.randomUUID().toString())
            .officerInCharge(UUID.randomUUID().toString())
            .officerPhone(UUID.randomUUID().toString())
            .populationCount(intCount.incrementAndGet())
            .householdCount(intCount.incrementAndGet());
    }
}

package com.policemanagement.com.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class ResidentTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + 2L * Integer.MAX_VALUE);
    private static final AtomicInteger intCount = new AtomicInteger(random.nextInt() + 2 * Short.MAX_VALUE);

    public static Resident getResidentSample1() {
        return new Resident().id(1L).fullName("fullName1").idCardNumber("idCardNumber1").birthYear(1).relationship("relationship1");
    }

    public static Resident getResidentSample2() {
        return new Resident().id(2L).fullName("fullName2").idCardNumber("idCardNumber2").birthYear(2).relationship("relationship2");
    }

    public static Resident getResidentRandomSampleGenerator() {
        return new Resident()
            .id(longCount.incrementAndGet())
            .fullName(UUID.randomUUID().toString())
            .idCardNumber(UUID.randomUUID().toString())
            .birthYear(intCount.incrementAndGet())
            .relationship(UUID.randomUUID().toString());
    }
}

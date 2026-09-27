package com.policemanagement.com.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class HouseholdTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + 2L * Integer.MAX_VALUE);
    private static final AtomicInteger intCount = new AtomicInteger(random.nextInt() + 2 * Short.MAX_VALUE);

    public static Household getHouseholdSample1() {
        return new Household()
            .id(1L)
            .code("code1")
            .houseNumber("houseNumber1")
            .street("street1")
            .hamlet("hamlet1")
            .neighborhoodGroup("neighborhoodGroup1")
            .alley("alley1")
            .ownerName("ownerName1")
            .ownerPhone("ownerPhone1")
            .businessName("businessName1")
            .businessCategory("businessCategory1")
            .residentsCount(1)
            .maleCount(1)
            .femaleCount(1)
            .under18Count(1)
            .above18Count(1)
            .warningMessage("warningMessage1")
            .licenseExpiry("licenseExpiry1")
            .licenseType("licenseType1")
            .lastCheckedDate("lastCheckedDate1")
            .officerInCharge("officerInCharge1");
    }

    public static Household getHouseholdSample2() {
        return new Household()
            .id(2L)
            .code("code2")
            .houseNumber("houseNumber2")
            .street("street2")
            .hamlet("hamlet2")
            .neighborhoodGroup("neighborhoodGroup2")
            .alley("alley2")
            .ownerName("ownerName2")
            .ownerPhone("ownerPhone2")
            .businessName("businessName2")
            .businessCategory("businessCategory2")
            .residentsCount(2)
            .maleCount(2)
            .femaleCount(2)
            .under18Count(2)
            .above18Count(2)
            .warningMessage("warningMessage2")
            .licenseExpiry("licenseExpiry2")
            .licenseType("licenseType2")
            .lastCheckedDate("lastCheckedDate2")
            .officerInCharge("officerInCharge2");
    }

    public static Household getHouseholdRandomSampleGenerator() {
        return new Household()
            .id(longCount.incrementAndGet())
            .code(UUID.randomUUID().toString())
            .houseNumber(UUID.randomUUID().toString())
            .street(UUID.randomUUID().toString())
            .hamlet(UUID.randomUUID().toString())
            .neighborhoodGroup(UUID.randomUUID().toString())
            .alley(UUID.randomUUID().toString())
            .ownerName(UUID.randomUUID().toString())
            .ownerPhone(UUID.randomUUID().toString())
            .businessName(UUID.randomUUID().toString())
            .businessCategory(UUID.randomUUID().toString())
            .residentsCount(intCount.incrementAndGet())
            .maleCount(intCount.incrementAndGet())
            .femaleCount(intCount.incrementAndGet())
            .under18Count(intCount.incrementAndGet())
            .above18Count(intCount.incrementAndGet())
            .warningMessage(UUID.randomUUID().toString())
            .licenseExpiry(UUID.randomUUID().toString())
            .licenseType(UUID.randomUUID().toString())
            .lastCheckedDate(UUID.randomUUID().toString())
            .officerInCharge(UUID.randomUUID().toString());
    }
}

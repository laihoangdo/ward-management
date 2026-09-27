package com.policemanagement.com.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class DocumentRecordTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + 2L * Integer.MAX_VALUE);

    public static DocumentRecord getDocumentRecordSample1() {
        return new DocumentRecord()
            .id(1L)
            .docName("docName1")
            .docType("docType1")
            .householdName("householdName1")
            .address("address1")
            .status("status1")
            .expiryDate("expiryDate1")
            .officer("officer1")
            .phone("phone1");
    }

    public static DocumentRecord getDocumentRecordSample2() {
        return new DocumentRecord()
            .id(2L)
            .docName("docName2")
            .docType("docType2")
            .householdName("householdName2")
            .address("address2")
            .status("status2")
            .expiryDate("expiryDate2")
            .officer("officer2")
            .phone("phone2");
    }

    public static DocumentRecord getDocumentRecordRandomSampleGenerator() {
        return new DocumentRecord()
            .id(longCount.incrementAndGet())
            .docName(UUID.randomUUID().toString())
            .docType(UUID.randomUUID().toString())
            .householdName(UUID.randomUUID().toString())
            .address(UUID.randomUUID().toString())
            .status(UUID.randomUUID().toString())
            .expiryDate(UUID.randomUUID().toString())
            .officer(UUID.randomUUID().toString())
            .phone(UUID.randomUUID().toString());
    }
}

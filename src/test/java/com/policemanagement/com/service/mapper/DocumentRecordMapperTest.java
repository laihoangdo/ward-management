package com.policemanagement.com.service.mapper;

import static com.policemanagement.com.domain.DocumentRecordAsserts.*;
import static com.policemanagement.com.domain.DocumentRecordTestSamples.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DocumentRecordMapperTest {

    private DocumentRecordMapper documentRecordMapper;

    @BeforeEach
    void setUp() {
        documentRecordMapper = new DocumentRecordMapperImpl();
    }

    @Test
    void shouldConvertToDtoAndBack() {
        var expected = getDocumentRecordSample1();
        var actual = documentRecordMapper.toEntity(documentRecordMapper.toDto(expected));
        assertDocumentRecordAllPropertiesEquals(expected, actual);
    }
}

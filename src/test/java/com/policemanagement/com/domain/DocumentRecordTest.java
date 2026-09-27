package com.policemanagement.com.domain;

import static com.policemanagement.com.domain.DocumentRecordTestSamples.*;
import static org.assertj.core.api.Assertions.assertThat;

import com.policemanagement.com.web.rest.TestUtil;
import org.junit.jupiter.api.Test;

class DocumentRecordTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(DocumentRecord.class);
        DocumentRecord documentRecord1 = getDocumentRecordSample1();
        DocumentRecord documentRecord2 = new DocumentRecord();
        assertThat(documentRecord1).isNotEqualTo(documentRecord2);

        documentRecord2.setId(documentRecord1.getId());
        assertThat(documentRecord1).isEqualTo(documentRecord2);

        documentRecord2 = getDocumentRecordSample2();
        assertThat(documentRecord1).isNotEqualTo(documentRecord2);
    }
}

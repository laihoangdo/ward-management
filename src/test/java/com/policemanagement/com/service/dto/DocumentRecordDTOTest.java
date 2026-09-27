package com.policemanagement.com.service.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.policemanagement.com.web.rest.TestUtil;
import org.junit.jupiter.api.Test;

class DocumentRecordDTOTest {

    @Test
    void dtoEqualsVerifier() throws Exception {
        TestUtil.equalsVerifier(DocumentRecordDTO.class);
        DocumentRecordDTO documentRecordDTO1 = new DocumentRecordDTO();
        documentRecordDTO1.setId(1L);
        DocumentRecordDTO documentRecordDTO2 = new DocumentRecordDTO();
        assertThat(documentRecordDTO1).isNotEqualTo(documentRecordDTO2);
        documentRecordDTO2.setId(documentRecordDTO1.getId());
        assertThat(documentRecordDTO1).isEqualTo(documentRecordDTO2);
        documentRecordDTO2.setId(2L);
        assertThat(documentRecordDTO1).isNotEqualTo(documentRecordDTO2);
        documentRecordDTO1.setId(null);
        assertThat(documentRecordDTO1).isNotEqualTo(documentRecordDTO2);
    }
}

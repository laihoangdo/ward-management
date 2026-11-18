package com.policemanagement.com.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.policemanagement.com.repository.DocumentRecordRepository;
import com.policemanagement.com.service.dto.DocumentRecordDTO;
import com.policemanagement.com.service.impl.DocumentRecordServiceImpl;
import com.policemanagement.com.service.mapper.DocumentRecordMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class DocumentLegacyWriteTest {

    @Test
    void oldCrudCannotBypassVersionReasonOrHistory() {
        var repository = mock(DocumentRecordRepository.class);
        var mapper = mock(DocumentRecordMapper.class);
        var service = new DocumentRecordServiceImpl(repository, mapper);
        var dto = new DocumentRecordDTO();
        assertEquals(
            409,
            assertThrows(ResponseStatusException.class, () -> service.save(dto))
                .getStatusCode()
                .value()
        );
        assertEquals(
            409,
            assertThrows(ResponseStatusException.class, () -> service.update(dto))
                .getStatusCode()
                .value()
        );
        assertEquals(
            409,
            assertThrows(ResponseStatusException.class, () -> service.partialUpdate(dto))
                .getStatusCode()
                .value()
        );
        assertEquals(
            409,
            assertThrows(ResponseStatusException.class, () -> service.delete(1L))
                .getStatusCode()
                .value()
        );
        verifyNoInteractions(repository, mapper);
    }
}

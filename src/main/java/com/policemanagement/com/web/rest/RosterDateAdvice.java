package com.policemanagement.com.web.rest;

import java.util.*;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/** JDBC DATE is a calendar date, not an instant in the server's historical time zone. */
@ControllerAdvice(assignableTypes = RosterResource.class)
public class RosterDateAdvice implements ResponseBodyAdvice<Object> {

    @Override
    public boolean supports(MethodParameter method, Class<? extends HttpMessageConverter<?>> converter) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(
        Object body,
        MethodParameter method,
        MediaType mediaType,
        Class<? extends HttpMessageConverter<?>> converter,
        ServerHttpRequest request,
        ServerHttpResponse response
    ) {
        return calendarDates(body);
    }

    static Object calendarDates(Object value) {
        if (value instanceof java.sql.Date date) return date.toLocalDate().toString();
        if (value instanceof Map<?, ?> map) {
            var result = new LinkedHashMap<Object, Object>();
            map.forEach((key, item) -> result.put(key, calendarDates(item)));
            return result;
        }
        if (value instanceof List<?> list) return list.stream().map(RosterDateAdvice::calendarDates).toList();
        return value;
    }
}

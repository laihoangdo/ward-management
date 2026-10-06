package com.policemanagement.com.config;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import tech.jhipster.config.JHipsterProperties;

/** Runs the production filter chain without a database or a live identity provider. */
@SpringJUnitConfig(GisSecurityTest.Config.class)
@WebAppConfiguration
class GisSecurityTest {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @ParameterizedTest
    @ValueSource(strings = { "households", "residents", "document-records", "patrol-logs", "security-alerts", "area-zones" })
    void anonymousCannotReadOrWriteBusinessData(String resource) throws Exception {
        String path = "/api/" + resource;
        mvc.perform(get(path).accept(MediaType.APPLICATION_JSON)).andExpect(status().isUnauthorized());
        mvc.perform(post(path).with(csrf()).accept(MediaType.APPLICATION_JSON)).andExpect(status().isUnauthorized());
        mvc.perform(
            patch(path + "/1")
                .with(csrf())
                .accept(MediaType.APPLICATION_JSON)
        ).andExpect(status().isUnauthorized());
        mvc.perform(
            delete(path + "/1")
                .with(csrf())
                .accept(MediaType.APPLICATION_JSON)
        ).andExpect(status().isUnauthorized());
    }

    @Test
    void sessionWritesRequireCsrf() throws Exception {
        mvc.perform(post("/api/households").with(user("officer").roles("USER"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/households").with(user("officer").roles("USER")).with(csrf())).andExpect(status().isOk());
        mvc.perform(get("/api/households").with(user("officer").roles("USER"))).andExpect(status().isOk());
    }

    @Configuration
    @EnableWebSecurity
    @EnableWebMvc
    @Import(TestSecurityConfiguration.class)
    static class Config {

        @Bean
        org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository authorizedClientRepository() {
            return new org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizedClientRepository();
        }

        @Bean
        SecurityFilterChain filterChain(HttpSecurity http) {
            return new SecurityConfiguration(new JHipsterProperties()).filterChain(http);
        }

        @Bean
        ProbeController probeController() {
            return new ProbeController();
        }
    }

    @RestController
    static class ProbeController {

        @RequestMapping("/api/{resource}")
        Map<String, String> businessData() {
            return Map.of("status", "ok");
        }
    }
}

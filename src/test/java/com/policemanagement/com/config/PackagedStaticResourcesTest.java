package com.policemanagement.com.config;

import static org.mockito.Mockito.*;

import java.net.URI;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.server.servlet.ConfigurableServletWebServerFactory;
import org.springframework.mock.env.MockEnvironment;
import tech.jhipster.config.JHipsterProperties;

class PackagedStaticResourcesTest {

    @Test
    void jarResourcesNeverBecomeAnIdeFilesystemDocumentRoot() throws Exception {
        var server = mock(ConfigurableServletWebServerFactory.class);
        var config = new WebConfigurer(new MockEnvironment(), new JHipsterProperties());
        config.setLocationForStaticAssets(server, URI.create("jar:file:/synthetic/app.jar!/BOOT-INF/classes/com/example/").toURL());
        verifyNoInteractions(server);
    }

    @Test
    void unavailableResourceLocationLeavesBootDefaultsIntact() {
        var server = mock(ConfigurableServletWebServerFactory.class);
        new WebConfigurer(new MockEnvironment(), new JHipsterProperties()).setLocationForStaticAssets(server, null);
        verifyNoInteractions(server);
    }
}

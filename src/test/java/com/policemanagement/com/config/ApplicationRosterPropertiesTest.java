package com.policemanagement.com.config;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.bind.handler.NoUnboundElementsBindHandler;
import org.springframework.mock.env.MockEnvironment;

class ApplicationRosterPropertiesTest {

    @Test
    void explicitKeyLocationBindsWithoutRelaxingUnknownPropertyProtection() {
        var env = new MockEnvironment().withProperty("application.roster.key-file", "target/synthetic-gate/data.key");
        var properties = Binder.get(env)
            .bind(
                "application",
                Bindable.of(ApplicationProperties.class),
                new NoUnboundElementsBindHandler(org.springframework.boot.context.properties.bind.BindHandler.DEFAULT)
            )
            .get();
        assertEquals("target/synthetic-gate/data.key", properties.getRoster().getKeyFile());
        assertEquals(".tc2-private/data.key", new ApplicationProperties().getRoster().getKeyFile());
    }
}

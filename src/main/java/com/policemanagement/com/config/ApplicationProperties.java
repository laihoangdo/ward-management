package com.policemanagement.com.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Properties specific to Monolithic.
 * <p>
 * Properties are configured in the {@code application.yml} file.
 * See {@link tech.jhipster.config.JHipsterProperties} for a good example.
 */
@ConfigurationProperties(prefix = "application", ignoreUnknownFields = false)
public class ApplicationProperties {

    private final Liquibase liquibase = new Liquibase();
    private final Roster roster = new Roster();
    private final Attachments attachments = new Attachments();

    // jhipster-needle-application-properties-property

    public Liquibase getLiquibase() {
        return liquibase;
    }

    public Roster getRoster() {
        return roster;
    }

    public Attachments getAttachments() {
        return attachments;
    }

    /** Server folder for attachment bytes (portraits, scanned papers); outside the web root and backed up with the database. */
    public static class Attachments {

        private String root = ".tc2-private/attachments";

        public String getRoot() {
            return root;
        }

        public void setRoot(String root) {
            this.root = root;
        }
    }

    public static class Roster {

        private String keyFile = ".tc2-private/data.key";

        public String getKeyFile() {
            return keyFile;
        }

        public void setKeyFile(String keyFile) {
            this.keyFile = keyFile;
        }
    }

    // jhipster-needle-application-properties-property-getter

    public static class Liquibase {

        private Boolean asyncStart = true;

        public Boolean getAsyncStart() {
            return asyncStart;
        }

        public void setAsyncStart(Boolean asyncStart) {
            this.asyncStart = asyncStart;
        }
    }

    // jhipster-needle-application-properties-property-class
}

package com.policemanagement.com.config;

import com.github.benmanes.caffeine.jcache.configuration.CaffeineConfiguration;
import java.util.OptionalLong;
import java.util.concurrent.TimeUnit;
import org.hibernate.cache.jcache.ConfigSettings;
import org.springframework.boot.cache.autoconfigure.JCacheManagerCustomizer;
import org.springframework.boot.hibernate.autoconfigure.HibernatePropertiesCustomizer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tech.jhipster.config.JHipsterProperties;

@Configuration
@EnableCaching
public class CacheConfiguration {

    private final javax.cache.configuration.Configuration<Object, Object> jcacheConfiguration;

    public CacheConfiguration(JHipsterProperties jHipsterProperties) {
        JHipsterProperties.Cache.Caffeine caffeine = jHipsterProperties.getCache().getCaffeine();

        CaffeineConfiguration<Object, Object> caffeineConfiguration = new CaffeineConfiguration<>();
        caffeineConfiguration.setMaximumSize(OptionalLong.of(caffeine.getMaxEntries()));
        caffeineConfiguration.setExpireAfterWrite(OptionalLong.of(TimeUnit.SECONDS.toNanos(caffeine.getTimeToLiveSeconds())));
        caffeineConfiguration.setStatisticsEnabled(true);
        jcacheConfiguration = caffeineConfiguration;
    }

    @Bean
    public HibernatePropertiesCustomizer hibernatePropertiesCustomizer(javax.cache.CacheManager cacheManager) {
        return hibernateProperties -> hibernateProperties.put(ConfigSettings.CACHE_MANAGER, cacheManager);
    }

    @Bean
    public JCacheManagerCustomizer cacheManagerCustomizer() {
        return cm -> {
            createCache(cm, com.policemanagement.com.repository.UserRepository.USERS_BY_LOGIN_CACHE);
            createCache(cm, com.policemanagement.com.repository.UserRepository.USERS_BY_EMAIL_CACHE);
            createCache(cm, com.policemanagement.com.domain.User.class.getName());
            createCache(cm, com.policemanagement.com.domain.Authority.class.getName());
            createCache(cm, com.policemanagement.com.domain.User.class.getName() + ".authorities");
            createCache(cm, com.policemanagement.com.domain.Household.class.getName());
            createCache(cm, com.policemanagement.com.domain.Household.class.getName() + ".residentses");
            createCache(cm, com.policemanagement.com.domain.Resident.class.getName());
            createCache(cm, com.policemanagement.com.domain.AreaZone.class.getName());
            createCache(cm, com.policemanagement.com.domain.AreaZone.class.getName() + ".householdses");
            createCache(cm, com.policemanagement.com.domain.DocumentRecord.class.getName());
            createCache(cm, com.policemanagement.com.domain.SecurityAlert.class.getName());
            createCache(cm, com.policemanagement.com.domain.PatrolLog.class.getName());
            // jhipster-needle-caffeine-add-entry
        };
    }

    private void createCache(javax.cache.CacheManager cm, String cacheName) {
        javax.cache.Cache<Object, Object> cache = cm.getCache(cacheName);
        if (cache != null) {
            cache.clear();
        } else {
            cm.createCache(cacheName, jcacheConfiguration);
        }
    }
}

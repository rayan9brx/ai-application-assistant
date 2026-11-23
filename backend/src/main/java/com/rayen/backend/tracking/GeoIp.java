package com.rayen.backend.tracking;

import com.maxmind.geoip2.DatabaseReader;
import com.maxmind.db.CHMCache;
import java.io.File;
import java.io.IOException;
import java.net.InetAddress;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Country and city for an IP address, from an offline .mmdb file (DB-IP "IP to City Lite" or
 * MaxMind GeoLite2 City), so no IP ever leaves the server. Without the file, lookups return
 * nothing and analytics still work. The IP is only looked up here and never stored.
 */
@Component
public class GeoIp {
    private static final Logger log = LoggerFactory.getLogger(GeoIp.class);

    public record Location(String country, String city) {
        static final Location UNKNOWN = new Location(null, null);
    }

    private final DatabaseReader reader;

    public GeoIp(@Value("${app.geoip.database:}") String path) {
        DatabaseReader opened = null;
        if (path.isBlank() || !new File(path).isFile()) {
            log.warn("No GeoIP database at '{}'; visitor countries and cities will be empty.", path);
        } else {
            try {
                opened = new DatabaseReader.Builder(new File(path)).withCache(new CHMCache()).build();
            } catch (IOException exception) {
                log.warn("Couldn't open the GeoIP database: {}", exception.getClass().getSimpleName());
            }
        }
        this.reader = opened;
    }

    public Location lookup(String ip) {
        if (reader == null || ip == null || ip.isBlank()) return Location.UNKNOWN;
        try {
            // getRemoteAddr() is always a literal address, so this never does a DNS lookup.
            return reader.tryCity(InetAddress.getByName(ip))
                .map(city -> new Location(clip(city.getCountry().getIsoCode(), 2), clip(city.getCity().getName(), 100)))
                .orElse(Location.UNKNOWN);
        } catch (Exception exception) {
            return Location.UNKNOWN;
        }
    }

    private static String clip(String value, int max) {
        if (value == null || value.isBlank()) return null;
        return value.length() > max ? value.substring(0, max) : value;
    }
}

package com.rayen.backend.analysis;

import java.io.IOException;
import java.io.InputStream;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reads the text of a job ad from a link the user pasted. Only public http(s) pages on the
 * standard ports: private, loopback and link-local addresses are refused (also after each
 * redirect), the body is capped at 2 MB and nothing is stored. Many job boards block automated
 * requests; then the user is asked to paste the text instead.
 */
@Component
public class JobAdFetcher {
    static final String PASTE_INSTEAD =
        "We couldn’t read the job ad from this link. Some job sites block automatic access. Copy the ad’s text and paste it instead.";
    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private static final int MAX_TEXT = 15000;
    private static final int MAX_REDIRECTS = 3;
    private static final Pattern LD_JSON = Pattern.compile(
        "<script[^>]*type=[\"']application/ld\\+json[\"'][^>]*>(.*?)</script>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern TITLE = Pattern.compile("<title[^>]*>(.*?)</title>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(6))
        .followRedirects(HttpClient.Redirect.NEVER)
        .build();
    private final JsonMapper json = JsonMapper.builder().build();

    public record JobAd(String text, String jobTitle, String company) {}

    public JobAd fetch(String link) {
        URI uri = parse(link);
        try {
            for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
                checkPublic(uri);
                var request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(10))
                    .header("User-Agent", "Mozilla/5.0 (compatible; RezumoJobAdReader/1.0)")
                    .header("Accept", "text/html,text/plain;q=0.9")
                    .header("Accept-Language", "de,en;q=0.8")
                    .GET().build();
                HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
                int status = response.statusCode();
                if (status >= 300 && status < 400) {
                    response.body().close();
                    String location = response.headers().firstValue("location").orElseThrow(JobAdFetcher::failed);
                    uri = parse(uri.resolve(location).toString());
                    continue;
                }
                String type = response.headers().firstValue("content-type").orElse("").toLowerCase(Locale.ROOT);
                if (status != 200 || !(type.contains("text/html") || type.contains("text/plain"))) {
                    response.body().close();
                    throw failed();
                }
                String body;
                try (InputStream in = response.body()) {
                    body = new String(in.readNBytes(MAX_BYTES), StandardCharsets.UTF_8);
                }
                return extract(body);
            }
            throw failed();
        } catch (IOException exception) {
            throw failed();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw failed();
        }
    }

    /** A JobPosting in the page's JSON-LD when there is one (most job boards), else the visible text. */
    JobAd extract(String html) {
        Matcher scripts = LD_JSON.matcher(html);
        while (scripts.find()) {
            try {
                JobAd ad = fromJsonLd(json.readTree(scripts.group(1).strip()));
                if (ad != null) return ad;
            } catch (RuntimeException ignored) {
                // Broken JSON-LD: try the next block or the page text.
            }
        }
        String text = toText(html);
        if (text.length() < 200) throw failed();
        Matcher title = TITLE.matcher(html);
        String pageTitle = title.find() ? limit(unescape(title.group(1)).strip(), 160) : "";
        return new JobAd(limit(text, MAX_TEXT), pageTitle, "");
    }

    private JobAd fromJsonLd(JsonNode node) {
        if (node == null) return null;
        if (node.isArray()) {
            for (JsonNode item : node) {
                JobAd ad = fromJsonLd(item);
                if (ad != null) return ad;
            }
            return null;
        }
        if (node.has("@graph")) return fromJsonLd(node.get("@graph"));
        if (!"JobPosting".equals(node.path("@type").asString(""))) return null;
        String text = toText(node.path("description").asString(""));
        if (text.length() < 100) return null;
        String title = node.path("title").asString("").strip();
        String company = node.path("hiringOrganization").path("name").asString("").strip();
        String full = (title.isEmpty() ? "" : title + "\n") + (company.isEmpty() ? "" : company + "\n\n") + text;
        return new JobAd(limit(full, MAX_TEXT), limit(title, 160), limit(company, 120));
    }

    static String toText(String html) {
        String text = html
            .replaceAll("(?is)<(script|style|noscript|svg|head|nav|footer|header|form)[^>]*>.*?</\\1>", " ")
            .replaceAll("(?is)<!--.*?-->", " ")
            .replaceAll("(?i)<(br|/p|/div|/li|/h[1-6]|/tr|/ul|/ol|/section|/article)[^>]*>", "\n")
            .replaceAll("(?i)<li[^>]*>", "\n• ")
            .replaceAll("(?s)<[^>]+>", " ");
        text = unescape(text)
            .replaceAll("[ \\t\\x0B\\f\\r\\u00A0]+", " ")
            .replaceAll(" *\\n *", "\n")
            .replaceAll("\\n{3,}", "\n\n");
        return text.strip();
    }

    private static String unescape(String text) {
        return text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
            .replace("&quot;", "\"").replace("&#39;", "'").replace("&apos;", "'")
            .replace("&auml;", "ä").replace("&ouml;", "ö").replace("&uuml;", "ü")
            .replace("&Auml;", "Ä").replace("&Ouml;", "Ö").replace("&Uuml;", "Ü").replace("&szlig;", "ß");
    }

    private static URI parse(String link) {
        try {
            URI uri = URI.create(link.strip());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            boolean standardPort = uri.getPort() == -1 || uri.getPort() == 80 || uri.getPort() == 443;
            if (!(scheme.equals("http") || scheme.equals("https")) || uri.getHost() == null || !standardPort
                || uri.getUserInfo() != null) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Paste a web link that starts with https://.");
            }
            return uri;
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Paste a web link that starts with https://.");
        }
    }

    /** Refuses hosts that resolve to this server, the private network or cloud metadata addresses. */
    static void checkPublic(URI uri) {
        try {
            for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
                if (!isPublic(address)) throw failed();
            }
        } catch (UnknownHostException exception) {
            throw failed();
        }
    }

    static boolean isPublic(InetAddress address) {
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
            || address.isSiteLocalAddress() || address.isMulticastAddress()) return false;
        byte[] b = address.getAddress();
        if (address instanceof Inet6Address) {
            return (b[0] & 0xfe) != 0xfc; // fc00::/7 unique local
        }
        int first = b[0] & 0xff;
        int second = b[1] & 0xff;
        return first != 0 && !(first == 100 && second >= 64 && second <= 127) // 100.64/10 shared
            && !(first == 192 && second == 0) && !(first == 198 && (second == 18 || second == 19)) && first < 224;
    }

    private static String limit(String text, int max) {
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static ResponseStatusException failed() {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, PASTE_INSTEAD);
    }
}

package com.rayen.backend;

import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CvUploadIntegrationTests {
    @LocalServerPort private int port;

    // Exercise real servlet multipart limits, which MockMvc does not enforce.
    @Test
    void containerReturnsStructuredSizeErrorsWithCors() throws Exception {
        for (int size : new int[]{5 * 1024 * 1024 + 1, 6 * 1024 * 1024 + 1}) {
            String body = "--test-boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"cv.pdf\"\r\nContent-Type: application/pdf\r\n\r\n"
                + "x".repeat(size) + "\r\n--test-boundary--\r\n";
            var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/cv/extract"))
                .header("Origin", "http://localhost:4200")
                .header("Content-Type", "multipart/form-data; boundary=test-boundary")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8)).build();
            var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
            assertEquals(413, response.statusCode());
            assertTrue(response.body().contains("FILE_TOO_LARGE"));
            assertEquals("http://localhost:4200", response.headers().firstValue("Access-Control-Allow-Origin").orElse(""));
        }
    }
    // Exercise the global filter so browser preflights cannot bypass controller CORS.
    @Test
    void browserPreflightsReachEveryApi() throws Exception {
        for (String path : new String[]{"/api/analyze", "/api/documents/export", "/api/cv/extract", "/api/health"}) {
            String method = path.endsWith("health") ? "GET" : "POST";
            var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Origin", "http://localhost:4200")
                .header("Access-Control-Request-Method", method)
                .header("Access-Control-Request-Headers", "content-type")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build();
            var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
            assertEquals(200, response.statusCode());
            assertEquals("http://localhost:4200", response.headers().firstValue("Access-Control-Allow-Origin").orElse(""));
            assertTrue(response.headers().firstValue("Access-Control-Allow-Methods").orElse("").contains(method));
        }
    }

}

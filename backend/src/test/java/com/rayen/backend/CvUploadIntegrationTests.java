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
}

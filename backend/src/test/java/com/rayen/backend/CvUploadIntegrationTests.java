package com.rayen.backend;

import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import static org.junit.jupiter.api.Assertions.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CvUploadIntegrationTests {
    @LocalServerPort private int port;

    // Exercise real servlet multipart limits, which MockMvc does not enforce.
    @Test
    void authenticatedContainerReturnsStructuredSizeErrors() throws Exception {
        var client = new AccountIntegrationTests.BrowserClient(port);
        client.csrf();
        String email = java.util.UUID.randomUUID() + "@example.test";
        assertEquals(201, client.register(email, AccountIntegrationTests.PASSWORD).statusCode());
        assertEquals(200, client.login(email, AccountIntegrationTests.PASSWORD).statusCode());
        client.csrf();
        for (int size : new int[]{5 * 1024 * 1024 + 1, 6 * 1024 * 1024 + 1}) {
            String body = "--test-boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"cv.pdf\"\r\nContent-Type: application/pdf\r\n\r\n"
                + "x".repeat(size) + "\r\n--test-boundary--\r\n";
            var response = client.send("POST", "/api/cv/extract", body,
                "multipart/form-data; boundary=test-boundary", client.token());
            assertEquals(413, response.statusCode());
            assertTrue(response.body().contains("FILE_TOO_LARGE"));
        }
    }
}

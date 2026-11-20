package com.rayen.backend;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.junit.jupiter.api.Assertions.*;

class RateLimitFilterTests {
    private static MockHttpServletResponse call(RateLimitFilter filter, String path, String ip) throws Exception {
        var request = new MockHttpServletRequest("POST", path);
        request.setRemoteAddr(ip);
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    @Test
    void limitsEachIpPerBucketAndLeavesOtherRoutesAlone() throws Exception {
        var filter = new RateLimitFilter(2, 3, 300);
        assertEquals(200, call(filter, "/api/cv/score", "1.1.1.1").getStatus());
        assertEquals(200, call(filter, "/api/cv/fix", "1.1.1.1").getStatus());
        var limited = call(filter, "/api/cv/tailor", "1.1.1.1");
        assertEquals(429, limited.getStatus());
        assertNotNull(limited.getHeader("Retry-After"));
        assertTrue(limited.getContentAsString().contains("Too many requests"));

        assertEquals(200, call(filter, "/api/cv/score", "2.2.2.2").getStatus(), "other IPs unaffected");
        assertEquals(200, call(filter, "/api/cv/extract", "1.1.1.1").getStatus(), "separate file bucket");
        assertEquals(200, call(filter, "/api/applications", "1.1.1.1").getStatus(), "not rate limited");
    }
}

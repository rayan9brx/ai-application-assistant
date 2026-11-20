package com.rayen.backend;

import com.rayen.backend.account.SupabaseAdminClient;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Saved CVs over the real security chain and JPA (H2). Tokens are injected the way a verified
 * Supabase JWT would arrive; the checks prove one user can never read or change another's rows.
 */
@SpringBootTest(properties = "app.rate-limit.data-per-10-min=100000")
class AccountIsolationTests {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Autowired private WebApplicationContext context;
    @MockitoBean private SupabaseAdminClient admin;

    private MockMvc mvc;
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private static RequestPostProcessor as(UUID user) {
        return jwt().jwt(token -> token.subject(user.toString()).claim("email", user + "@example.com")
            .claim("user_metadata", Map.of("full_name", "Test User")));
    }

    private JsonNode call(MockHttpServletRequestBuilder request, UUID user, Object body, int status) throws Exception {
        request.with(as(user));
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(body));
        String response = mvc.perform(request).andExpect(status().is(status)).andReturn().getResponse().getContentAsString();
        return response.isEmpty() ? null : JSON.readTree(response);
    }

    private static Map<String, Object> cvBody(String title) {
        return Map.of("title", title, "content", Map.of("text", "Taylor Brooks\nFrontend Developer"),
            "jobDescription", "React role");
    }

    private static Map<String, Object> analysisBody(int overall) {
        return Map.of("result", Map.of("overall", overall, "label", "Good",
            "categories", Map.of("content", 70, "format", 80, "optimization", 60, "bestPractices", 75,
                "applicationReady", 65), "issues", java.util.List.of()));
    }

    @Test
    void accountEndpointsNeedAToken() throws Exception {
        mvc.perform(get("/api/cvs")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/me")).andExpect(status().isUnauthorized());
        verifyNoInteractions(admin);
    }

    @Test
    void guestEndpointsIgnoreTokens() throws Exception {
        mvc.perform(get("/api/health").header("Authorization", "Bearer not-a-real-token")).andExpect(status().isOk());
    }

    @Test
    void profileIsCreatedFromTheTokenOnFirstUse() throws Exception {
        JsonNode me = call(get("/api/me"), alice, null, 200);
        assertEquals(alice.toString(), me.get("id").asString());
        assertEquals("Test User", me.get("fullName").asString());
        assertEquals("free", me.get("plan").asString());
        assertEquals(alice + "@example.com", me.get("email").asString());

        JsonNode renamed = call(patch("/api/me"), alice, Map.of("fullName", "Alice Example"), 200);
        assertEquals("Alice Example", renamed.get("fullName").asString());
    }

    @Test
    void savedCvsAndHistoryBelongToTheirOwnerOnly() throws Exception {
        JsonNode cv = call(post("/api/cvs"), alice, cvBody("Alice CV"), 201);
        String id = cv.get("id").asString();
        assertEquals("Taylor Brooks\nFrontend Developer", cv.get("content").get("text").asString());
        call(post("/api/cvs/" + id + "/analyses"), alice, analysisBody(61), 201);
        call(post("/api/cvs/" + id + "/analyses"), alice, analysisBody(74), 201);

        JsonNode list = call(get("/api/cvs"), alice, null, 200);
        assertEquals(1, list.size());
        assertEquals(74, list.get(0).get("lastScore").asInt());
        JsonNode history = call(get("/api/cvs/" + id + "/analyses"), alice, null, 200);
        assertEquals(2, history.size());
        assertEquals(74, history.get(0).get("overallScore").asInt());
        assertEquals(80, history.get(0).get("categoryScores").get("format").asInt());

        // Bob sees none of it and cannot touch it; every attempt looks like a missing CV.
        assertEquals(0, call(get("/api/cvs"), bob, null, 200).size());
        call(get("/api/cvs/" + id), bob, null, 404);
        call(put("/api/cvs/" + id), bob, cvBody("Hijacked"), 404);
        call(post("/api/cvs/" + id + "/duplicate"), bob, null, 404);
        call(get("/api/cvs/" + id + "/analyses"), bob, null, 404);
        call(post("/api/cvs/" + id + "/analyses"), bob, analysisBody(99), 404);
        call(delete("/api/cvs/" + id), bob, null, 404);

        JsonNode unchanged = call(get("/api/cvs/" + id), alice, null, 200);
        assertEquals("Alice CV", unchanged.get("title").asString());
        assertEquals(2, call(get("/api/cvs/" + id + "/analyses"), alice, null, 200).size());
    }

    @Test
    void saveAsFirstRequestKeepsTheSignupName() throws Exception {
        UUID dana = UUID.randomUUID();
        call(post("/api/cvs"), dana, cvBody("First save"), 201);
        assertEquals("Test User", call(get("/api/me"), dana, null, 200).get("fullName").asString());
    }

    @Test
    void simultaneousFirstRequestsOfANewUserAllSucceed() throws Exception {
        UUID carol = UUID.randomUUID();
        int parallel = 6;
        var start = new java.util.concurrent.CountDownLatch(1);
        var pool = java.util.concurrent.Executors.newFixedThreadPool(parallel);
        try {
            var results = new java.util.ArrayList<java.util.concurrent.Future<Integer>>();
            for (int i = 0; i < parallel; i++) {
                int n = i;
                results.add(pool.submit(() -> {
                    start.await();
                    return mvc.perform(post("/api/cvs").with(as(carol)).contentType(MediaType.APPLICATION_JSON)
                            .content(JSON.writeValueAsString(cvBody("CV " + n))))
                        .andReturn().getResponse().getStatus();
                }));
            }
            start.countDown();
            for (var result : results) assertEquals(201, result.get(30, java.util.concurrent.TimeUnit.SECONDS));
        } finally {
            pool.shutdownNow();
        }
        assertEquals(parallel, call(get("/api/cvs"), carol, null, 200).size());
        assertEquals(carol.toString(), call(get("/api/me"), carol, null, 200).get("id").asString());
    }

    @Test
    void ownerCanUpdateDuplicateAndDelete() throws Exception {
        String id = call(post("/api/cvs"), alice, cvBody("Draft"), 201).get("id").asString();
        assertEquals("Final", call(put("/api/cvs/" + id), alice, cvBody("Final"), 200).get("title").asString());
        JsonNode copy = call(post("/api/cvs/" + id + "/duplicate"), alice, null, 201);
        assertEquals("Final (copy)", copy.get("title").asString());
        call(post("/api/cvs/" + id + "/analyses"), alice, analysisBody(50), 201);

        call(delete("/api/cvs/" + id), alice, null, 204);
        call(get("/api/cvs/" + id), alice, null, 404);
        assertEquals(1, call(get("/api/cvs"), alice, null, 200).size());
    }

    @Test
    void invalidAnalysesAndBodiesAreRejected() throws Exception {
        String id = call(post("/api/cvs"), alice, cvBody("CV"), 201).get("id").asString();
        call(post("/api/cvs/" + id + "/analyses"), alice, Map.of("result", Map.of("label", "Good")), 400);
        call(post("/api/cvs/" + id + "/analyses"), alice, Map.of("result", Map.of("overall", 140,
            "categories", Map.of())), 400);
        call(post("/api/cvs"), alice, Map.of("title", "", "content", Map.of()), 400);
        call(get("/api/cvs/not-a-uuid"), alice, null, 400);
    }

    @Test
    void deletingAnAccountRemovesOnlyThatUsersData() throws Exception {
        String aliceCv = call(post("/api/cvs"), alice, cvBody("Alice CV"), 201).get("id").asString();
        call(post("/api/cvs/" + aliceCv + "/analyses"), alice, analysisBody(70), 201);
        String bobCv = call(post("/api/cvs"), bob, cvBody("Bob CV"), 201).get("id").asString();

        call(delete("/api/me"), alice, null, 204);
        verify(admin).deleteUser(alice);
        verify(admin, never()).deleteUser(bob);

        assertEquals(0, call(get("/api/cvs"), alice, null, 200).size());
        call(get("/api/cvs/" + aliceCv), alice, null, 404);
        assertEquals("Bob CV", call(get("/api/cvs/" + bobCv), bob, null, 200).get("title").asString());
    }
}

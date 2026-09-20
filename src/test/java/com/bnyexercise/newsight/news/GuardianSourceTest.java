package com.bnyexercise.newsight.news;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.net.SocketTimeoutException;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.client.ResponseCreator;
import org.springframework.web.client.RestClient;

/**
 * Pins how Guardian Content API JSON becomes {@link Article}s. The canned responses copy the shape
 * of a live response (checked 2026-09-20) but the content is invented — the Guardian's terms cap
 * storing their content at 24 hours, so no real articles belong in the repo.
 */
class GuardianSourceTest {

    private static final String KEY = "test-key-123";
    private static final String SEARCH_URL = "https://content.guardianapis.com/search";

    private MockRestServiceServer server;
    private GuardianSource source;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        source = new GuardianSource(builder, KEY);
    }

    @Test
    void mapsResultToArticle() {
        server.expect(requestTo(startsWith(SEARCH_URL)))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("q", "climate"))
                .andExpect(queryParam("order-by", "relevance"))
                .andExpect(queryParam("show-fields", "trailText,byline"))
                // Keeps paid partner content out of the results.
                .andExpect(queryParam("tag", "-tone/advertisement-features"))
                .andExpect(queryParam("api-key", KEY))
                .andRespond(withJson(response("""
                        {
                          "id": "environment/2026/sep/18/invented",
                          "type": "article",
                          "sectionId": "environment",
                          "sectionName": "Environment",
                          "webPublicationDate": "2026-09-18T12:00:00Z",
                          "webTitle": "Invented Guardian Headline",
                          "webUrl": "https://www.theguardian.com/environment/2026/sep/18/invented",
                          "isHosted": false,
                          "fields": {"trailText": "Invented trail text.", "byline": "Jane Example"}
                        }
                        """)));

        List<Article> articles = source.search("climate");

        assertThat(articles)
                .containsExactly(
                        new Article(
                                "Invented Guardian Headline",
                                "The Guardian",
                                "Jane Example",
                                "Invented trail text.",
                                "https://www.theguardian.com/environment/2026/sep/18/invented",
                                Instant.parse("2026-09-18T12:00:00Z"),
                                "Environment"));
        server.verify();
    }

    @Test
    void flattensMarkupInTrailText() {
        server.expect(requestTo(startsWith(SEARCH_URL)))
                .andRespond(withJson(response("""
                        {
                          "webTitle": "Markup in the trail",
                          "webUrl": "https://www.theguardian.com/invented",
                          "webPublicationDate": "2026-09-18T12:00:00Z",
                          "fields": {"trailText": "<strong>Exclusive:</strong> tax &amp; spending"}
                        }
                        """)));

        assertThat(source.search("anything").getFirst().summary())
                .isEqualTo("Exclusive: tax & spending");
    }

    @Test
    void copesWithAnEmptyBylineAndMissingFields() {
        server.expect(requestTo(startsWith(SEARCH_URL)))
                .andRespond(withJson(response("""
                        {
                          "webTitle": "No byline here",
                          "webUrl": "https://www.theguardian.com/invented",
                          "webPublicationDate": "2026-09-18T12:00:00Z",
                          "sectionName": "Membership",
                          "fields": {"trailText": "Only a trail.", "byline": ""}
                        },
                        {
                          "webTitle": "No fields at all",
                          "webUrl": "https://www.theguardian.com/invented-2",
                          "webPublicationDate": "2026-09-18T12:00:00Z"
                        }
                        """)));

        List<Article> articles = source.search("anything");

        assertThat(articles).hasSize(2);
        assertThat(articles.getFirst().author()).isNull();
        assertThat(articles.getFirst().category()).isEqualTo("Membership");
        assertThat(articles.getLast().summary()).isNull();
        assertThat(articles.getLast().category()).isNull();
    }

    @Test
    void skipsResultsWithoutTitleUrlOrUsableDate() {
        server.expect(requestTo(startsWith(SEARCH_URL)))
                .andRespond(withJson(response("""
                        {"webTitle": "", "webUrl": "https://x/1", "webPublicationDate": "2026-09-18T12:00:00Z"},
                        {"webTitle": "No url", "webPublicationDate": "2026-09-18T12:00:00Z"},
                        {"webTitle": "Bad date", "webUrl": "https://x/3", "webPublicationDate": "yesterday"},
                        {"webTitle": "Kept", "webUrl": "https://x/4", "webPublicationDate": "2026-09-18T12:00:00Z"}
                        """)));

        assertThat(source.search("anything")).extracting(Article::title).containsExactly("Kept");
    }

    @Test
    void returnsEmptyListWhenNothingMatches() {
        server.expect(requestTo(startsWith(SEARCH_URL))).andRespond(withJson(response("")));

        assertThat(source.search("zzzznomatches")).isEmpty();
    }

    @Test
    void encodesSpecialCharactersInTheQuery() {
        server.expect(requestTo(containsString("q=AT%26T"))).andRespond(withJson(response("")));

        source.search("AT&T");

        server.verify();
    }

    @Test
    void makesNoCallWhenTheKeyIsMissing() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer noCallsExpected = MockRestServiceServer.bindTo(builder).build();
        GuardianSource disabled = new GuardianSource(builder, "");

        assertThat(disabled.search("climate")).isEmpty();
        noCallsExpected.verify();
    }

    @Test
    void reportsRateLimitingWithoutExposingTheKey() {
        server.expect(requestTo(startsWith(SEARCH_URL)))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        assertThatThrownBy(() -> source.search("climate"))
                .isInstanceOf(NewsSourceException.class)
                .satisfies(GuardianSourceTest::assertKeyNotExposed)
                .satisfies(
                        thrown ->
                                assertThat(((NewsSourceException) thrown).reason())
                                        .isEqualTo(NewsSourceException.RATE_LIMITED));
    }

    @Test
    void reportsABadKeyAsUnavailableWithoutExposingIt() {
        server.expect(requestTo(startsWith(SEARCH_URL)))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {"message": "Invalid authentication credentials"}
                                """));

        assertThatThrownBy(() -> source.search("climate"))
                .isInstanceOf(NewsSourceException.class)
                .satisfies(GuardianSourceTest::assertKeyNotExposed)
                .satisfies(
                        thrown ->
                                assertThat(((NewsSourceException) thrown).reason())
                                        .isEqualTo(NewsSourceException.UNAVAILABLE));
    }

    @Test
    void reportsNetworkErrorsWithoutExposingTheKey() {
        server.expect(requestTo(startsWith(SEARCH_URL)))
                .andRespond(withException(new SocketTimeoutException("Read timed out")));

        assertThatThrownBy(() -> source.search("climate"))
                .isInstanceOf(NewsSourceException.class)
                .satisfies(GuardianSourceTest::assertKeyNotExposed);
    }

    private static void assertKeyNotExposed(Throwable thrown) {
        for (Throwable t = thrown; t != null; t = t.getCause()) {
            assertThat(t.toString()).doesNotContain(KEY);
        }
    }

    /** Wraps results in the live response envelope. */
    private static String response(String results) {
        return """
                {"response": {"status": "ok", "total": 1, "pageSize": 10, "results": [%s]}}
                """.formatted(results);
    }

    private static ResponseCreator withJson(String body) {
        return withSuccess(body, MediaType.APPLICATION_JSON);
    }
}

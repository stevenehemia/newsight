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
 * Pins how NYT Article Search JSON becomes {@link Article}s. The canned responses copy the shape of
 * a live response (checked 2026-09-19) but the content is invented — NYT's terms cap storing their
 * content at 24 hours, so no real articles belong in the repo.
 */
class NytSourceTest {

    private static final String KEY = "test-key-123";
    private static final String SEARCH_URL = "https://api.nytimes.com/svc/search/v2/articlesearch.json";

    private MockRestServiceServer server;
    private NytSource source;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        source = new NytSource(builder, KEY);
    }

    @Test
    void mapsDocToArticle() {
        server.expect(requestTo(startsWith(SEARCH_URL)))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("q", "climate"))
                .andExpect(queryParam("sort", "relevance"))
                .andExpect(queryParam("api-key", KEY))
                .andRespond(withJson(response("""
                        {
                          "headline": {"main": "Invented Climate Headline", "kicker": null},
                          "byline": {"original": "By Jane Example"},
                          "snippet": "Invented snippet.",
                          "abstract": "Invented abstract.",
                          "web_url": "https://www.nytimes.com/2026/09/18/climate/invented.html",
                          "pub_date": "2026-09-18T12:00:00Z",
                          "source": "The New York Times",
                          "section_name": "Climate",
                          "multimedia": {"default": {"url": "https://example.com/a.jpg"}}
                        }
                        """)));

        List<Article> articles = source.search(SearchCriteria.keyword("climate"));

        assertThat(articles)
                .containsExactly(
                        new Article(
                                "Invented Climate Headline",
                                "The New York Times",
                                "By Jane Example",
                                "Invented snippet.",
                                "https://www.nytimes.com/2026/09/18/climate/invented.html",
                                Instant.parse("2026-09-18T12:00:00Z")));
        server.verify();
    }

    @Test
    void fallsBackToAbstractAndDefaultSourceName() {
        server.expect(requestTo(startsWith(SEARCH_URL)))
                .andRespond(withJson(response("""
                        {
                          "headline": {"main": "No snippet here"},
                          "snippet": "",
                          "abstract": "Only an abstract.",
                          "web_url": "https://www.nytimes.com/invented",
                          "pub_date": "2026-09-18T12:00:00Z"
                        }
                        """)));

        Article article = source.search(SearchCriteria.keyword("anything")).getFirst();

        assertThat(article.summary()).isEqualTo("Only an abstract.");
        assertThat(article.source()).isEqualTo("The New York Times");
        assertThat(article.author()).isNull();
    }

    @Test
    void skipsDocsWithoutHeadlineUrlOrUsableDate() {
        server.expect(requestTo(startsWith(SEARCH_URL)))
                .andRespond(withJson(response("""
                        {"headline": {"main": ""}, "web_url": "https://x/1", "pub_date": "2026-09-18T12:00:00Z"},
                        {"headline": {"main": "No url"}, "pub_date": "2026-09-18T12:00:00Z"},
                        {"headline": {"main": "Bad date"}, "web_url": "https://x/3", "pub_date": "yesterday"},
                        {"headline": {"main": "Kept"}, "web_url": "https://x/4", "pub_date": "2026-09-18T12:00:00Z"}
                        """)));

        assertThat(source.search(SearchCriteria.keyword("anything"))).extracting(Article::title).containsExactly("Kept");
    }

    @Test
    void returnsEmptyListWhenNothingMatches() {
        server.expect(requestTo(startsWith(SEARCH_URL))).andRespond(withJson(response("")));

        assertThat(source.search(SearchCriteria.keyword("zzzznomatches"))).isEmpty();
    }

    @Test
    void encodesSpecialCharactersInTheQuery() {
        // "AT&T" sent unencoded would split into q=AT and a stray T= parameter.
        server.expect(requestTo(containsString("q=AT%26T")))
                .andRespond(withJson(response("")));

        source.search(SearchCriteria.keyword("AT&T"));

        server.verify();
    }

    @Test
    void makesNoCallWhenTheKeyIsMissing() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer noCallsExpected = MockRestServiceServer.bindTo(builder).build();
        NytSource disabled = new NytSource(builder, "");

        assertThat(disabled.search(SearchCriteria.keyword("climate"))).isEmpty();
        noCallsExpected.verify();
    }

    @Test
    void reportsHttpErrorsWithoutExposingTheKey() {
        server.expect(requestTo(startsWith(SEARCH_URL)))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {"fault": {"faultstring": "Rate limit quota violation"}}
                                """));

        assertThatThrownBy(() -> source.search(SearchCriteria.keyword("climate")))
                .isInstanceOf(NewsSourceException.class)
                .hasMessageContaining("429")
                .satisfies(NytSourceTest::assertKeyNotExposed)
                .satisfies(
                        thrown ->
                                assertThat(((NewsSourceException) thrown).reason())
                                        .isEqualTo(NewsSourceException.RATE_LIMITED));
    }

    @Test
    void reportsNetworkErrorsWithoutExposingTheKey() {
        server.expect(requestTo(startsWith(SEARCH_URL)))
                .andRespond(withException(new SocketTimeoutException("Read timed out")));

        assertThatThrownBy(() -> source.search(SearchCriteria.keyword("climate")))
                .isInstanceOf(NewsSourceException.class)
                .satisfies(NytSourceTest::assertKeyNotExposed)
                .satisfies(
                        thrown ->
                                assertThat(((NewsSourceException) thrown).reason())
                                        .isEqualTo(NewsSourceException.UNAVAILABLE));
    }

    private static void assertKeyNotExposed(Throwable thrown) {
        for (Throwable t = thrown; t != null; t = t.getCause()) {
            assertThat(t.toString()).doesNotContain(KEY);
        }
    }

    /** Wraps docs in the live response envelope, including the undocumented metadata key. */
    private static String response(String docs) {
        return """
                {"status": "OK", "copyright": "Invented",
                 "response": {"docs": [%s], "metadata": {"hits": 1, "offset": 0, "time": 5}}}
                """.formatted(docs);
    }

    private static ResponseCreator withJson(String body) {
        return withSuccess(body, MediaType.APPLICATION_JSON);
    }
}

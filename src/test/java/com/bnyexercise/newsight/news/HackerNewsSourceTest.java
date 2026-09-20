package com.bnyexercise.newsight.news;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

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
 * Pins how Hacker News JSON becomes {@link Article}s. {@link MockRestServiceServer} intercepts the
 * HTTP call and replies with canned JSON, so nothing reaches the real API.
 */
class HackerNewsSourceTest {

    private MockRestServiceServer server;
    private HackerNewsSource source;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        source = new HackerNewsSource(builder);
    }

    @Test
    void mapsStoryToArticle() {
        server.expect(requestTo(startsWith("https://hn.algolia.com/api/v1/search")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("query", "spring"))
                .andExpect(queryParam("tags", "story"))
                .andRespond(withJson("""
                        {"hits": [{
                          "title": "Spring Boot 4 released",
                          "url": "https://example.com/spring-boot-4",
                          "author": "someuser",
                          "story_text": "Body text",
                          "created_at": "2026-09-17T10:15:30Z",
                          "objectID": "123",
                          "points": 42
                        }]}
                        """));

        List<Article> articles = source.search("spring");

        assertThat(articles)
                .containsExactly(
                        new Article(
                                "Spring Boot 4 released",
                                "Hacker News",
                                "someuser",
                                "Body text",
                                "https://example.com/spring-boot-4",
                                Instant.parse("2026-09-17T10:15:30Z"),
                                null));
        server.verify();
    }

    @Test
    void linksToDiscussionWhenStoryHasNoUrl() {
        server.expect(requestTo(startsWith("https://hn.algolia.com/api/v1/search")))
                .andRespond(withJson("""
                        {"hits": [{
                          "title": "Ask HN: How do you learn a new framework?",
                          "url": null,
                          "author": "asker",
                          "created_at": "2026-09-17T10:15:30Z",
                          "objectID": "456"
                        }]}
                        """));

        List<Article> articles = source.search("framework");

        assertThat(articles).singleElement()
                .extracting(Article::url)
                .isEqualTo("https://news.ycombinator.com/item?id=456");
    }

    @Test
    void flattensHtmlStoryTextIntoPlainText() {
        // Shape taken from a live response: links as anchors, slashes as &#x2F;, & as &amp;.
        server.expect(requestTo(startsWith("https://hn.algolia.com/api/v1/search")))
                .andRespond(withJson("""
                        {"hits": [{
                          "title": "Kimi K3: Open Frontier Intelligence",
                          "url": "https://example.com/kimi",
                          "author": "someuser",
                          "story_text": "<a href=\\"https:&#x2F;&#x2F;example.com&#x2F;en\\" rel=\\"nofollow\\">https:&#x2F;&#x2F;example.com&#x2F;en</a><p>Performance &amp; price analysis",
                          "created_at": "2026-09-17T10:15:30Z",
                          "objectID": "123"
                        }]}
                        """));

        Article article = source.search("kimi").getFirst();

        assertThat(article.summary())
                .isEqualTo("https://example.com/en Performance & price analysis");
    }

    @Test
    void leavesTheSummaryNullWhenStoryTextIsOnlyMarkup() {
        server.expect(requestTo(startsWith("https://hn.algolia.com/api/v1/search")))
                .andRespond(withJson("""
                        {"hits": [{
                          "title": "Empty body",
                          "url": "https://example.com/x",
                          "story_text": "<p></p>",
                          "created_at": "2026-09-17T10:15:30Z",
                          "objectID": "124"
                        }]}
                        """));

        assertThat(source.search("anything").getFirst().summary()).isNull();
    }

    @Test
    void skipsHitsWithoutTitleOrUsableDate() {
        server.expect(requestTo(startsWith("https://hn.algolia.com/api/v1/search")))
                .andRespond(withJson("""
                        {"hits": [
                          {"title": null, "created_at": "2026-09-17T10:15:30Z", "objectID": "1"},
                          {"title": "Bad date", "created_at": "yesterday", "objectID": "2"},
                          {"title": "No date", "objectID": "3"},
                          {"title": "Kept", "created_at": "2026-09-17T10:15:30Z", "objectID": "4"}
                        ]}
                        """));

        List<Article> articles = source.search("anything");

        assertThat(articles).extracting(Article::title).containsExactly("Kept");
    }

    @Test
    void returnsEmptyListWhenNothingMatches() {
        server.expect(requestTo(startsWith("https://hn.algolia.com/api/v1/search")))
                .andRespond(withJson("""
                        {"hits": [], "nbHits": 0}
                        """));

        assertThat(source.search("zzzznomatches")).isEmpty();
    }

    @Test
    void reportsHttpErrorsAsSourceFailures() {
        server.expect(requestTo(startsWith("https://hn.algolia.com/api/v1/search")))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

        assertThatThrownBy(() -> source.search("anything"))
                .isInstanceOf(NewsSourceException.class)
                .satisfies(
                        thrown ->
                                assertThat(((NewsSourceException) thrown).reason())
                                        .isEqualTo(NewsSourceException.UNAVAILABLE));
    }

    @Test
    void encodesSpecialCharactersInTheQuery() {
        // "AT&T" sent unencoded would split into query=AT and a stray T= parameter.
        server.expect(requestTo(containsString("query=AT%26T")))
                .andRespond(withJson("""
                        {"hits": []}
                        """));

        source.search("AT&T");

        server.verify();
    }

    private static ResponseCreator withJson(String body) {
        return withSuccess(body, MediaType.APPLICATION_JSON);
    }
}

package com.bnyexercise.newsight.news;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Searches Hacker News via the Algolia API.
 *
 * <p>Chosen as the first source because it needs no API key. The vendor's JSON shape is confined to
 * the private records at the bottom of this class — nothing outside sees {@code created_at} or
 * {@code objectID}.
 */
@Component
public class HackerNewsSource implements NewsSource {

    private static final String SOURCE_NAME = "Hacker News";
    private static final String ITEM_URL = "https://news.ycombinator.com/item?id=";
    private static final Pattern TAGS = Pattern.compile("<[^>]+>");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private final RestClient client;

    HackerNewsSource(RestClient.Builder builder) {
        this.client = builder.baseUrl("https://hn.algolia.com/api/v1").build();
    }

    @Override
    public String name() {
        return SOURCE_NAME;
    }

    @Override
    public List<Article> search(String query) {
        SearchResponse response;
        try {
            response =
                    client.get()
                            .uri(uri -> uri.path("/search")
                                    .queryParam("query", query)
                                    .queryParam("tags", "story")
                                    .build())
                            .retrieve()
                            .body(SearchResponse.class);
        } catch (RestClientException ex) {
            throw new NewsSourceException(
                    NewsSourceException.UNAVAILABLE, "Hacker News request failed: " + ex.getMessage(), ex);
        }

        if (response == null || response.hits() == null) {
            return List.of();
        }
        return response.hits().stream()
                .filter(hit -> hit.title() != null)
                .map(this::toArticle)
                .filter(Objects::nonNull)
                .toList();
    }

    private Article toArticle(Hit hit) {
        Instant publishedAt = parseInstant(hit.createdAt());
        if (publishedAt == null) {
            return null;
        }
        // Ask HN and similar self-posts carry no outbound url; link to the discussion instead.
        String url = hit.url() != null ? hit.url() : ITEM_URL + hit.objectId();
        // Hacker News has no sections, so the article carries no category.
        return new Article(
                hit.title(),
                SOURCE_NAME,
                hit.author(),
                toPlainText(hit.storyText()),
                url,
                publishedAt,
                null);
    }

    /**
     * Hacker News story text is HTML ({@code <a href="https:&#x2F;&#x2F;…">}), but the frontend
     * renders summaries as text — deliberately, since this is user-submitted content and rendering
     * it as markup would be an injection risk. So flatten it here.
     *
     * <p>Tags are removed before entities are decoded, so a decoded {@code &lt;} cannot turn into a
     * tag afterwards.
     */
    private static String toPlainText(String html) {
        if (html == null) {
            return null;
        }
        // A space, not an empty string: "one<p>two" should not become "onetwo".
        String withoutTags = TAGS.matcher(html).replaceAll(" ");
        String collapsed = WHITESPACE.matcher(HtmlUtils.htmlUnescape(withoutTags)).replaceAll(" ").trim();
        return collapsed.isEmpty() ? null : collapsed;
    }

    private Instant parseInstant(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record SearchResponse(List<Hit> hits) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Hit(
            String title,
            String url,
            String author,
            @JsonProperty("story_text") String storyText,
            @JsonProperty("created_at") String createdAt,
            @JsonProperty("objectID") String objectId) {}
}

package com.bnyexercise.newsight.news;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Searches Hacker News via the Algolia API.
 *
 * <p>Chosen as the first source because it needs no API key. The vendor's JSON shape is confined to
 * the private records at the bottom of this class — nothing outside sees {@code created_at} or
 * {@code objectID}.
 */
@Component
public class HackerNewsSource {

    private static final String SOURCE_NAME = "Hacker News";
    private static final String ITEM_URL = "https://news.ycombinator.com/item?id=";

    private final RestClient client;

    HackerNewsSource(RestClient.Builder builder) {
        this.client = builder.baseUrl("https://hn.algolia.com/api/v1").build();
    }

    public List<Article> search(String query) {
        SearchResponse response =
                client.get()
                        .uri(uri -> uri.path("/search")
                                .queryParam("query", query)
                                .queryParam("tags", "story")
                                .build())
                        .retrieve()
                        .body(SearchResponse.class);

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
        return new Article(hit.title(), SOURCE_NAME, hit.author(), hit.storyText(), url, publishedAt);
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

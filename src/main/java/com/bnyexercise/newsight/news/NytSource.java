package com.bnyexercise.newsight.news;

import static com.bnyexercise.newsight.news.ProviderValues.blankToNull;
import static com.bnyexercise.newsight.news.ProviderValues.parseInstant;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Searches the New York Times Article Search API.
 *
 * <p>Asks NYT for its most relevant matches, over its whole archive, with no date limit;
 * {@link NewsService} then sorts the merged results by date.
 *
 * <p>Needs {@code NYT_API_KEY}; without it the source is switched off and returns nothing, so the
 * app still starts in CI and for anyone without a key. The key can only be sent as a query
 * parameter, so it must never be logged with the request URL.
 */
@Component
public class NytSource implements NewsSource {

    private static final Logger log = LoggerFactory.getLogger(NytSource.class);
    private static final String DEFAULT_SOURCE_NAME = "The New York Times";

    private final RestClient client;
    private final String apiKey;

    NytSource(RestClient.Builder builder, @Value("${newsight.sources.nyt.api-key:}") String apiKey) {
        this.client = builder.baseUrl("https://api.nytimes.com/svc/search/v2").build();
        this.apiKey = apiKey;
        if (!StringUtils.hasText(apiKey)) {
            log.info("NYT source disabled: NYT_API_KEY is not set");
        }
    }

    @Override
    public String name() {
        return DEFAULT_SOURCE_NAME;
    }

    @Override
    public List<Article> search(String query) {
        if (!StringUtils.hasText(apiKey)) {
            return List.of();
        }
        SearchResponse body;
        try {
            // Template variables, not literal values, so characters like & and + in "AT&T" are encoded.
            body =
                    client.get()
                            .uri(uri -> uri.path("/articlesearch.json")
                                    .queryParam("q", "{q}")
                                    .queryParam("sort", "relevance")
                                    .queryParam("api-key", "{key}")
                                    .build(query, apiKey))
                            .retrieve()
                            .body(SearchResponse.class);
        } catch (RestClientException ex) {
            throw NewsSourceException.from("NYT", ex);
        }

        if (body == null || body.response() == null || body.response().docs() == null) {
            return List.of();
        }
        return body.response().docs().stream()
                .map(NytSource::toArticle)
                .filter(Objects::nonNull)
                .toList();
    }

    private static Article toArticle(Doc doc) {
        String title = doc.headline() == null ? null : doc.headline().main();
        Instant publishedAt = parseInstant(doc.pubDate());
        if (!StringUtils.hasText(title) || !StringUtils.hasText(doc.webUrl()) || publishedAt == null) {
            return null;
        }
        String source = StringUtils.hasText(doc.source()) ? doc.source() : DEFAULT_SOURCE_NAME;
        // Kept verbatim, "By " prefix included: NYT's terms forbid altering their content.
        String author = doc.byline() == null ? null : blankToNull(doc.byline().original());
        String summary = StringUtils.hasText(doc.snippet()) ? doc.snippet() : blankToNull(doc.abstractText());
        return new Article(
                title, source, author, summary, doc.webUrl(), publishedAt, blankToNull(doc.sectionName()));
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record SearchResponse(Result response) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Result(List<Doc> docs) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Doc(
            Headline headline,
            Byline byline,
            String snippet,
            @JsonProperty("abstract") String abstractText,
            @JsonProperty("web_url") String webUrl,
            @JsonProperty("pub_date") String pubDate,
            @JsonProperty("section_name") String sectionName,
            String source) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Headline(String main) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Byline(String original) {}
}

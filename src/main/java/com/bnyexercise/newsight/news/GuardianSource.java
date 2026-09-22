package com.bnyexercise.newsight.news;

import static com.bnyexercise.newsight.news.ProviderValues.blankToNull;
import static com.bnyexercise.newsight.news.ProviderValues.parseInstant;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
 * Searches the Guardian Content API.
 *
 * <p>The only source so far that always carries a section, a summary and a byline, so it fills the
 * gaps Hacker News leaves. Asks for its most relevant matches with no date limit, matching the
 * ranking policy; {@link NewsService} sorts the merged list by date.
 *
 * <p>Needs {@code GUARDIAN_API_KEY}; without it the source is switched off and makes no calls.
 *
 * <p>The Guardian's terms require its logo on any page showing this content, forbid altering
 * headlines and bylines, and cap caching at 24 hours.
 */
@Component
public class GuardianSource implements NewsSource {

    private static final Logger log = LoggerFactory.getLogger(GuardianSource.class);
    private static final String SOURCE_NAME = "The Guardian";

    private final RestClient client;
    private final String apiKey;

    GuardianSource(RestClient.Builder builder, @Value("${newsight.sources.guardian.api-key:}") String apiKey) {
        this.client = builder.baseUrl("https://content.guardianapis.com").build();
        this.apiKey = apiKey;
        if (!StringUtils.hasText(apiKey)) {
            log.info("Guardian source disabled: GUARDIAN_API_KEY is not set");
        }
    }

    @Override
    public String name() {
        return SOURCE_NAME;
    }

    @Override
    public List<Article> search(String query) {
        if (!StringUtils.hasText(apiKey)) {
            return List.of();
        }
        SearchResponse body;
        try {
            // Template variables, not literal values, so characters like & in "AT&T" are encoded.
            body =
                    client.get()
                            .uri(uri -> uri.path("/search")
                                    .queryParam("q", "{q}")
                                    .queryParam("order-by", "relevance")
                                    // Summary and author are only returned when asked for.
                                    .queryParam("show-fields", "trailText,byline")
                                    // Leading "-" excludes a tag. Without this, paid partner
                                    // content ranks among the results: a live "climate" search
                                    // returned a sponsored piece filed under "University of
                                    // Melbourne: Advancing healthcare" in the top five.
                                    .queryParam("tag", "-tone/advertisement-features")
                                    .queryParam("page-size", "10")
                                    .queryParam("api-key", "{key}")
                                    .build(query, apiKey))
                            .retrieve()
                            .body(SearchResponse.class);
        } catch (RestClientException ex) {
            throw NewsSourceException.from("Guardian", ex);
        }

        if (body == null || body.response() == null || body.response().results() == null) {
            return List.of();
        }
        return body.response().results().stream()
                .map(GuardianSource::toArticle)
                .filter(Objects::nonNull)
                .toList();
    }

    private static Article toArticle(Result result) {
        Instant publishedAt = parseInstant(result.webPublicationDate());
        if (!StringUtils.hasText(result.webTitle())
                || !StringUtils.hasText(result.webUrl())
                || publishedAt == null) {
            return null;
        }
        Fields fields = result.fields();
        // Kept verbatim: the Guardian's terms forbid altering headlines and bylines.
        String author = fields == null ? null : blankToNull(fields.byline());
        // trailText can contain markup, which the UI would otherwise show literally.
        String summary = fields == null ? null : HtmlText.toPlainText(fields.trailText());
        return new Article(
                result.webTitle(),
                SOURCE_NAME,
                author,
                summary,
                result.webUrl(),
                publishedAt,
                blankToNull(result.sectionName()));
    }

    // The total count is at response.total; not mapped until something needs it.
    @JsonIgnoreProperties(ignoreUnknown = true)
    record SearchResponse(Response response) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Response(List<Result> results) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Result(
            String webTitle, String webUrl, String sectionName, String webPublicationDate, Fields fields) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Fields(String trailText, String byline) {}
}

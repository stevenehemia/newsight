package com.bnyexercise.newsight.news;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Plain unit tests: sources are lambdas, so no Spring context and no HTTP. */
class NewsServiceTest {

    private static final Instant MONDAY = Instant.parse("2026-09-14T09:00:00Z");
    private static final Instant TUESDAY = Instant.parse("2026-09-15T09:00:00Z");
    private static final Instant WEDNESDAY = Instant.parse("2026-09-16T09:00:00Z");

    @Test
    void combinesResultsFromEverySource() {
        Article fromFirst = article("First source story", MONDAY);
        Article fromSecond = article("Second source story", TUESDAY);
        NewsService service =
                new NewsService(List.of(criteria -> List.of(fromFirst), criteria -> List.of(fromSecond)));

        assertThat(service.search(SearchCriteria.keyword("anything"))).containsExactlyInAnyOrder(fromFirst, fromSecond);
    }

    @Test
    void sortsMergedResultsNewestFirst() {
        Article monday = article("Monday", MONDAY);
        Article tuesday = article("Tuesday", TUESDAY);
        Article wednesday = article("Wednesday", WEDNESDAY);
        NewsService service =
                new NewsService(
                        List.of(criteria -> List.of(monday, wednesday), criteria -> List.of(tuesday)));

        assertThat(service.search(SearchCriteria.keyword("anything"))).containsExactly(wednesday, tuesday, monday);
    }

    @Test
    void passesTheQueryToEachSource() {
        List<String> received = new ArrayList<>();
        NewsSource recording =
                criteria -> {
                    received.add(criteria.query());
                    return List.of();
                };
        NewsService service = new NewsService(List.of(recording, recording));

        service.search(SearchCriteria.keyword("spring boot"));

        assertThat(received).containsExactly("spring boot", "spring boot");
    }

    @Test
    void returnsEmptyListWhenNoSourceFindsAnything() {
        NewsService service = new NewsService(List.of(criteria -> List.of(), criteria -> List.of()));

        assertThat(service.search(SearchCriteria.keyword("zzzznomatches"))).isEmpty();
    }

    @Test
    void keepsOtherSourcesResultsWhenOneSourceFails() {
        Article healthy = article("Still here", MONDAY);
        NewsSource failing =
                criteria -> {
                    throw new NewsSourceException("HTTP 429 rate limited", null);
                };
        NewsService service = new NewsService(List.of(failing, criteria -> List.of(healthy)));

        assertThat(service.search(SearchCriteria.keyword("anything"))).containsExactly(healthy);
    }

    @Test
    void keepsOtherSourcesResultsWhenOneSourceFailsUnexpectedly() {
        Article healthy = article("Still here", MONDAY);
        NewsSource buggy =
                criteria -> {
                    throw new IllegalStateException("bug in a source");
                };
        NewsService service = new NewsService(List.of(buggy, criteria -> List.of(healthy)));

        assertThat(service.search(SearchCriteria.keyword("anything"))).containsExactly(healthy);
    }

    @Test
    void failsOnlyWhenEverySourceFails() {
        NewsSource failing =
                criteria -> {
                    throw new NewsSourceException("down", null);
                };
        NewsService service = new NewsService(List.of(failing, failing));

        assertThatThrownBy(() -> service.search(SearchCriteria.keyword("anything")))
                .isInstanceOf(NewsUnavailableException.class);
    }

    private static Article article(String title, Instant publishedAt) {
        return new Article(
                title, "Test", null, null, "https://example.com/" + title.hashCode(), publishedAt);
    }
}

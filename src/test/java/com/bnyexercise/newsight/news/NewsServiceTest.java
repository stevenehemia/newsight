package com.bnyexercise.newsight.news;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Plain unit tests: sources are lambdas or small stubs, so no Spring context and no HTTP. */
class NewsServiceTest {

    private static final Instant MONDAY = Instant.parse("2026-09-14T09:00:00Z");
    private static final Instant TUESDAY = Instant.parse("2026-09-15T09:00:00Z");
    private static final Instant WEDNESDAY = Instant.parse("2026-09-16T09:00:00Z");

    @Test
    void combinesResultsFromEverySource() {
        Article fromFirst = article("First source story", MONDAY);
        Article fromSecond = article("Second source story", TUESDAY);
        NewsService service =
                new NewsService(
                        List.of(query -> List.of(fromFirst), query -> List.of(fromSecond)));

        assertThat(service.search("anything").articles())
                .containsExactlyInAnyOrder(fromFirst, fromSecond);
    }

    @Test
    void sortsMergedResultsNewestFirst() {
        Article monday = article("Monday", MONDAY);
        Article tuesday = article("Tuesday", TUESDAY);
        Article wednesday = article("Wednesday", WEDNESDAY);
        NewsService service =
                new NewsService(
                        List.of(query -> List.of(monday, wednesday), query -> List.of(tuesday)));

        assertThat(service.search("anything").articles())
                .containsExactly(wednesday, tuesday, monday);
    }

    @Test
    void passesTheQueryToEachSource() {
        List<String> received = new ArrayList<>();
        NewsSource recording =
                query -> {
                    received.add(query);
                    return List.of();
                };
        NewsService service = new NewsService(List.of(recording, recording));

        service.search("spring boot");

        assertThat(received).containsExactly("spring boot", "spring boot");
    }

    @Test
    void returnsEmptyListWhenNoSourceFindsAnything() {
        NewsService service = new NewsService(List.of(query -> List.of(), query -> List.of()));

        SearchResults results = service.search("zzzznomatches");

        assertThat(results.articles()).isEmpty();
        assertThat(results.unavailable()).isEmpty();
    }

    @Test
    void reportsAFailingSourceAndKeepsTheOthersResults() {
        Article healthy = article("Still here", MONDAY);
        NewsService service =
                new NewsService(
                        List.of(
                                failing("Busy Source", NewsSourceException.RATE_LIMITED),
                                query -> List.of(healthy)));

        SearchResults results = service.search("anything");

        assertThat(results.articles()).containsExactly(healthy);
        assertThat(results.unavailable())
                .extracting(SearchResults.SourceNote::source, SearchResults.SourceNote::reason)
                .containsExactly(tuple("Busy Source", "rate limited"));
    }

    @Test
    void reportsASourceThatFailsUnexpectedlyAsUnavailable() {
        Article healthy = article("Still here", MONDAY);
        NewsSource buggy =
                new NewsSource() {
                    @Override
                    public String name() {
                        return "Buggy Source";
                    }

                    @Override
                    public List<Article> search(String query) {
                        throw new IllegalStateException("bug in a source");
                    }
                };
        NewsService service = new NewsService(List.of(buggy, query -> List.of(healthy)));

        SearchResults results = service.search("anything");

        assertThat(results.articles()).containsExactly(healthy);
        assertThat(results.unavailable())
                .extracting(SearchResults.SourceNote::source, SearchResults.SourceNote::reason)
                .containsExactly(tuple("Buggy Source", "temporarily unavailable"));
    }

    @Test
    void failsOnlyWhenEverySourceFails() {
        NewsService service =
                new NewsService(
                        List.of(
                                failing("One", NewsSourceException.UNAVAILABLE),
                                failing("Two", NewsSourceException.UNAVAILABLE)));

        assertThatThrownBy(() -> service.search("anything"))
                .isInstanceOf(NewsUnavailableException.class);
    }

    private static NewsSource failing(String name, String reason) {
        return new NewsSource() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public List<Article> search(String query) {
                throw new NewsSourceException(reason, "provider said no", null);
            }
        };
    }

    private static Article article(String title, Instant publishedAt) {
        return new Article(
                title, "Test", null, null, "https://example.com/" + title.hashCode(), publishedAt, null);
    }
}

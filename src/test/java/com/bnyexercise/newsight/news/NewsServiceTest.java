package com.bnyexercise.newsight.news;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Plain unit tests: sources are lambdas, so no Spring context and no HTTP. */
class NewsServiceTest {

    @Test
    void combinesResultsFromEverySource() {
        Article fromFirst = article("First source story");
        Article fromSecond = article("Second source story");
        NewsService service =
                new NewsService(List.of(query -> List.of(fromFirst), query -> List.of(fromSecond)));

        assertThat(service.search("anything")).containsExactly(fromFirst, fromSecond);
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

        assertThat(service.search("zzzznomatches")).isEmpty();
    }

    private static Article article(String title) {
        return new Article(
                title,
                "Test",
                null,
                null,
                "https://example.com/" + title.hashCode(),
                Instant.parse("2026-09-17T10:15:30Z"));
    }
}

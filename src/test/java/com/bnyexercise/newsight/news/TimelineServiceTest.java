package com.bnyexercise.newsight.news;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Plain unit tests: the counting source is a stub, so no Spring context and no HTTP. */
class TimelineServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-21T12:00:00Z");

    @Test
    void buildsOneRangePerWeekEndingNow() {
        List<Instant[]> ranges = TimelineService.weeksEndingAt(NOW, 8);

        assertThat(ranges).hasSize(8);
        assertThat(ranges.getLast()[1]).isEqualTo(NOW);
        assertThat(ranges.getFirst()[0]).isEqualTo(NOW.minus(Duration.ofDays(56)));
    }

    @Test
    void leavesNoGapOrOverlapBetweenWeeks() {
        List<Instant[]> ranges = TimelineService.weeksEndingAt(NOW, 8);

        for (int i = 1; i < ranges.size(); i++) {
            // One week's end is the next week's start: an article on the boundary is counted once.
            assertThat(ranges.get(i)[0]).isEqualTo(ranges.get(i - 1)[1]);
            assertThat(Duration.between(ranges.get(i)[0], ranges.get(i)[1])).isEqualTo(Duration.ofDays(7));
        }
    }

    @Test
    void countsEachWeekOldestFirst() {
        List<Instant> requestedStarts = new ArrayList<>();
        CountingSource source =
                counting(
                        (query, from, to) -> {
                            requestedStarts.add(from);
                            return 5;
                        });
        TimelineService service = new TimelineService(List.of(source));

        Timeline timeline = service.weekly("climate", 3, NOW);

        assertThat(timeline.source()).isEqualTo("Test Source");
        assertThat(timeline.weeks()).extracting(Timeline.Week::count).containsExactly(5L, 5L, 5L);
        assertThat(requestedStarts).isSorted();
        assertThat(timeline.weeks().getFirst().start()).isEqualTo(NOW.minus(Duration.ofDays(21)));
    }

    @Test
    void passesTheQueryThrough() {
        List<String> queries = new ArrayList<>();
        TimelineService service =
                new TimelineService(
                        List.of(
                                counting(
                                        (query, from, to) -> {
                                            queries.add(query);
                                            return 0;
                                        })));

        service.weekly("rust", 2, NOW);

        assertThat(queries).containsExactly("rust", "rust");
    }

    @Test
    void failsWhenNothingCanCount() {
        TimelineService service = new TimelineService(List.of());

        assertThatThrownBy(() -> service.weekly("climate", 8, NOW))
                .isInstanceOf(NewsSourceException.class);
    }

    @Test
    void letsASourceFailureSurface() {
        TimelineService service =
                new TimelineService(
                        List.of(
                                counting(
                                        (query, from, to) -> {
                                            throw new NewsSourceException(
                                                    NewsSourceException.RATE_LIMITED, "slow down", null);
                                        })));

        // The timeline is an extra, but it should not pretend a failed count was zero coverage.
        assertThatThrownBy(() -> service.weekly("climate", 8, NOW))
                .isInstanceOf(NewsSourceException.class);
    }

    private interface Counter {
        long count(String query, Instant from, Instant to);
    }

    private static CountingSource counting(Counter counter) {
        return new CountingSource() {
            @Override
            public String name() {
                return "Test Source";
            }

            @Override
            public long countMatches(String query, Instant from, Instant to) {
                return counter.count(query, from, to);
            }
        };
    }
}

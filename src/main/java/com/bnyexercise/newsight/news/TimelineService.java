package com.bnyexercise.newsight.news;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/** Builds a week-by-week count of how often a topic was covered. */
@Service
public class TimelineService {

    private static final Duration WEEK = Duration.ofDays(7);

    private final List<CountingSource> sources;

    TimelineService(List<CountingSource> sources) {
        this.sources = List.copyOf(sources);
    }

    /**
     * One row of counts for the most recent {@code weeks} weeks, oldest first.
     *
     * <p>Uses a single source — the first that can count — rather than summing several. Adding NYT
     * later means deciding whether two providers' counts belong on the same axis at all: Hacker
     * News posts and NYT articles are different units, and adding them would invent a number that
     * means nothing. That is a design decision, not a loop.
     */
    public Timeline weekly(String query, int weeks, Instant now) {
        if (sources.isEmpty()) {
            throw new NewsSourceException(
                    NewsSourceException.UNAVAILABLE, "No source can count matches", null);
        }
        CountingSource source = sources.getFirst();
        List<Timeline.Week> counted = new ArrayList<>();
        for (Instant[] range : weeksEndingAt(now, weeks)) {
            counted.add(new Timeline.Week(range[0], range[1], source.countMatches(query, range[0], range[1])));
        }
        return new Timeline(source.name(), counted);
    }

    /**
     * The boundaries of the most recent {@code weeks} weeks, oldest first, each half-open so an
     * article published exactly on a boundary is counted once rather than twice.
     */
    static List<Instant[]> weeksEndingAt(Instant now, int weeks) {
        List<Instant[]> ranges = new ArrayList<>();
        for (int week = weeks; week > 0; week--) {
            Instant start = now.minus(WEEK.multipliedBy(week));
            ranges.add(new Instant[] {start, start.plus(WEEK)});
        }
        return ranges;
    }
}

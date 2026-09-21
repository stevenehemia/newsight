package com.bnyexercise.newsight.news;

import java.time.Instant;
import java.util.List;

/**
 * How much a topic was covered, week by week.
 *
 * <p>Names the source it came from rather than implying general coverage: counted against Hacker
 * News, "rust" is a genuine signal and "fashion" is close to meaningless, and the UI has to be able
 * to say which it is showing.
 */
public record Timeline(String source, List<Week> weeks) {

    /** Half-open: {@code start} exclusive, {@code end} inclusive, so weeks cannot double-count. */
    public record Week(Instant start, Instant end, long count) {}
}

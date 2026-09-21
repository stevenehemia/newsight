package com.bnyexercise.newsight.news;

import java.time.Instant;

/**
 * A source that can say how many articles match, without fetching them.
 *
 * <p>Deliberately separate from {@link NewsSource}: counting is a different capability, and not
 * every provider can or may do it.
 *
 * <ul>
 *   <li>{@code HackerNewsSource} implements it — {@code hitsPerPage=0} returns a count for free.
 *   <li>{@code NytSource} could, but its 5 calls per minute make eight weeks take about 96
 *       seconds, so it needs caching first.
 *   <li>{@code GuardianSource} deliberately does <strong>not</strong>. Clause 6(g) of the
 *       Guardian's terms forbids aggregating its data "to generate any patterns, trends or
 *       correlations". Leaving it off this interface makes that a compile-time fact rather than a
 *       runtime check someone might later delete.
 * </ul>
 */
public interface CountingSource {

    /** The provider's name, as shown to the user alongside the counts. */
    String name();

    /**
     * Articles matching {@code query} published in {@code (from, to]} — start exclusive, end
     * inclusive, so consecutive weeks sharing a boundary never count the same article twice.
     */
    long countMatches(String query, Instant from, Instant to);
}

package com.bnyexercise.newsight.news;

import java.time.Instant;

/**
 * A news article in Newsight's own shape.
 *
 * <p>Every external source gets translated into this record before it leaves the application, so
 * the frontend never sees a vendor's field names. Record components become JSON keys verbatim.
 *
 * <p>{@code category} is whatever section the provider filed the article under, kept in the
 * provider's own words rather than mapped to a shared vocabulary: the frontend builds its filter
 * options from the values that actually come back. It is null for providers that have no sections
 * (Hacker News, GNews), and those show as "Uncategorised".
 */
public record Article(
        String title,
        String source,
        String author,
        String summary,
        String url,
        Instant publishedAt,
        String category) {}

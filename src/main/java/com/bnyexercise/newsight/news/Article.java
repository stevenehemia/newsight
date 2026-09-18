package com.bnyexercise.newsight.news;

import java.time.Instant;

/**
 * A news article in Newsight's own shape.
 *
 * <p>Every external source gets translated into this record before it leaves the application, so
 * the frontend never sees a vendor's field names. Record components become JSON keys verbatim.
 */
public record Article(
        String title, String source, String author, String summary, String url, Instant publishedAt) {}

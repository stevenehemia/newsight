package com.bnyexercise.newsight.news;

import java.util.List;

/**
 * What a search produced, including what it could not produce.
 *
 * <p>The frontend needs more than the articles: it has to explain why a source is missing from the
 * results, whether because it cannot apply a filter ({@code skipped}) or because it failed
 * ({@code unavailable}).
 */
public record SearchResults(
        List<Article> articles, List<SourceNote> skipped, List<SourceNote> unavailable) {

    /** A source that contributed nothing, and the short reason to show the user. */
    public record SourceNote(String source, String reason) {}
}

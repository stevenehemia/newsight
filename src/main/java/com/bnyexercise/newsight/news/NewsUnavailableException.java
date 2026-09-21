package com.bnyexercise.newsight.news;

/**
 * Every news source failed, so there is nothing to show.
 *
 * <p>Carries the results anyway: the articles are empty, but the per-source reasons are exactly
 * what the user needs to be told, and a bare 503 would throw them away. {@link NewsController}
 * answers 503 with this body.
 */
public class NewsUnavailableException extends RuntimeException {

    private final SearchResults results;

    public NewsUnavailableException(SearchResults results) {
        super("No news source is currently available");
        this.results = results;
    }

    public SearchResults results() {
        return results;
    }
}

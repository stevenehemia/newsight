package com.bnyexercise.newsight.news;

/**
 * What the user is searching for.
 *
 * <p>One object rather than a growing parameter list: filters such as company, category and country
 * are added here, and each {@link NewsSource} translates the ones it supports into its own API's
 * parameters.
 */
public record SearchCriteria(String query) {

    public static SearchCriteria keyword(String query) {
        return new SearchCriteria(query);
    }
}

package com.bnyexercise.newsight.news;

import java.util.List;

/**
 * A news provider Newsight can search.
 *
 * <p>Each implementation owns one vendor's API: its URL, parameters, and JSON shape. It returns
 * results already translated into {@link Article}, so nothing outside the implementation depends on
 * the vendor.
 */
public interface NewsSource {

    List<Article> search(String query);

    /**
     * The provider's name as shown to the user, e.g. when explaining that it was unavailable.
     *
     * <p>Defaulted so a lambda can still stand in for a source in tests.
     */
    default String name() {
        return getClass().getSimpleName();
    }
}

package com.bnyexercise.newsight.news;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Searches every {@link NewsSource} and merges their results, newest first.
 *
 * <p>A failing source is logged and skipped, so one provider being down or rate-limited never
 * breaks a search. Only when every source fails is the request itself a failure.
 */
@Service
public class NewsService {

    private static final Logger log = LoggerFactory.getLogger(NewsService.class);

    private static final Comparator<Article> NEWEST_FIRST =
            Comparator.comparing(Article::publishedAt, Comparator.nullsLast(Comparator.reverseOrder()));

    private final List<NewsSource> sources;

    /** Spring injects every {@link NewsSource} bean, so adding a source needs no change here. */
    NewsService(List<NewsSource> sources) {
        this.sources = List.copyOf(sources);
    }

    public SearchResults search(String query) {
        List<Article> articles = new ArrayList<>();
        List<SearchResults.SourceNote> unavailable = new ArrayList<>();
        for (NewsSource source : sources) {
            try {
                articles.addAll(source.search(query));
            } catch (NewsSourceException ex) {
                unavailable.add(new SearchResults.SourceNote(source.name(), ex.reason()));
                log.warn("{} failed: {}", source.name(), ex.getMessage());
            } catch (RuntimeException ex) {
                unavailable.add(
                        new SearchResults.SourceNote(source.name(), NewsSourceException.UNAVAILABLE));
                log.error("{} failed unexpectedly", source.name(), ex);
            }
        }
        if (!sources.isEmpty() && unavailable.size() == sources.size()) {
            // No articles, but the reasons still matter to the user.
            throw new NewsUnavailableException(new SearchResults(List.of(), List.of(), unavailable));
        }
        articles.sort(NEWEST_FIRST);
        return new SearchResults(articles, List.of(), unavailable);
    }
}

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

    public List<Article> search(SearchCriteria criteria) {
        List<Article> articles = new ArrayList<>();
        int failures = 0;
        for (NewsSource source : sources) {
            try {
                articles.addAll(source.search(criteria));
            } catch (NewsSourceException ex) {
                failures++;
                log.warn("{} failed: {}", nameOf(source), ex.getMessage());
            } catch (RuntimeException ex) {
                failures++;
                log.error("{} failed unexpectedly", nameOf(source), ex);
            }
        }
        if (!sources.isEmpty() && failures == sources.size()) {
            throw new NewsUnavailableException();
        }
        articles.sort(NEWEST_FIRST);
        return articles;
    }

    private static String nameOf(NewsSource source) {
        return source.getClass().getSimpleName();
    }
}

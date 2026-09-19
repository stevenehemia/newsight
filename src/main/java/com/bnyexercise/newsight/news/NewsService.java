package com.bnyexercise.newsight.news;

import java.util.List;
import org.springframework.stereotype.Service;

/** Searches every {@link NewsSource} and combines their results into one list. */
@Service
public class NewsService {

    private final List<NewsSource> sources;

    /** Spring injects every {@link NewsSource} bean, so adding a source needs no change here. */
    NewsService(List<NewsSource> sources) {
        this.sources = List.copyOf(sources);
    }

    public List<Article> search(String query) {
        return sources.stream().flatMap(source -> source.search(query).stream()).toList();
    }
}

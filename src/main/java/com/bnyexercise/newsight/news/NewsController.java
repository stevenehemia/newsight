package com.bnyexercise.newsight.news;

import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** HTTP edge of the search feature: query parameters in, JSON and status codes out. */
@RestController
public class NewsController {

    private final NewsService newsService;
    private final TimelineService timelineService;

    NewsController(NewsService newsService, TimelineService timelineService) {
        this.newsService = newsService;
        this.timelineService = timelineService;
    }

    /**
     * Long enough for any real search, short enough that providers accept it: GNews caps queries at
     * 200 characters, so a longer one would fail at the provider and be reported as that source
     * being unavailable, which blames the wrong thing.
     */
    private static final int MAX_QUERY_LENGTH = 200;

    /** How many weeks of history the timeline covers. */
    private static final int TIMELINE_WEEKS = 8;

    @GetMapping("/api/news/search")
    SearchResults search(@RequestParam String q) {
        validate(q);
        return newsService.search(q);
    }

    /**
     * Week-by-week counts for the same query. A separate endpoint rather than part of the search:
     * it answers a different question, takes longer, and must be able to fail without taking the
     * articles with it.
     */
    @GetMapping("/api/news/timeline")
    Timeline timeline(@RequestParam String q) {
        validate(q);
        return timelineService.weekly(q, TIMELINE_WEEKS, Instant.now());
    }

    private static void validate(String q) {
        if (!StringUtils.hasText(q)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Search query must not be blank");
        }
        if (q.length() > MAX_QUERY_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Search query must be at most " + MAX_QUERY_LENGTH + " characters");
        }
    }

    /** Answers 503 with the per-source reasons, rather than an error page that explains nothing. */
    @ExceptionHandler(NewsUnavailableException.class)
    ResponseEntity<SearchResults> everySourceFailed(NewsUnavailableException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(ex.results());
    }
}

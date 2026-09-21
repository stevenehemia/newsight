package com.bnyexercise.newsight.news;

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

    NewsController(NewsService newsService) {
        this.newsService = newsService;
    }

    /**
     * Long enough for any real search, short enough that providers accept it: GNews caps queries at
     * 200 characters, so a longer one would fail at the provider and be reported as that source
     * being unavailable, which blames the wrong thing.
     */
    private static final int MAX_QUERY_LENGTH = 200;

    @GetMapping("/api/news/search")
    SearchResults search(@RequestParam String q) {
        if (!StringUtils.hasText(q)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Search query must not be blank");
        }
        if (q.length() > MAX_QUERY_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Search query must be at most " + MAX_QUERY_LENGTH + " characters");
        }
        return newsService.search(q);
    }

    /** Answers 503 with the per-source reasons, rather than an error page that explains nothing. */
    @ExceptionHandler(NewsUnavailableException.class)
    ResponseEntity<SearchResults> everySourceFailed(NewsUnavailableException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(ex.results());
    }
}

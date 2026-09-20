package com.bnyexercise.newsight.news;

import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
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

    @GetMapping("/api/news/search")
    SearchResults search(@RequestParam String q) {
        if (!StringUtils.hasText(q)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Search query must not be blank");
        }
        return newsService.search(SearchCriteria.keyword(q));
    }
}

package com.bnyexercise.newsight.news;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/** Every news source failed, so there is nothing to show. Answered as 503 Service Unavailable. */
@ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
public class NewsUnavailableException extends RuntimeException {

    public NewsUnavailableException() {
        super("No news source is currently available");
    }
}

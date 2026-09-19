package com.bnyexercise.newsight.news;

/**
 * A news source could not answer: an HTTP error, a timeout, or a response it could not read.
 *
 * <p>Sources throw this instead of letting client exceptions escape, so {@link NewsService} can tell
 * an expected provider failure (log a line, carry on with the other sources) from a bug. Messages
 * must never include request URLs, because several providers take the API key as a query
 * parameter.
 */
public class NewsSourceException extends RuntimeException {

    public NewsSourceException(String message, Throwable cause) {
        super(message, cause);
    }
}

package com.bnyexercise.newsight.news;

/**
 * A news source could not answer: an HTTP error, a timeout, or a response it could not read.
 *
 * <p>Sources throw this instead of letting client exceptions escape, so {@link NewsService} can tell
 * an expected provider failure (report it, carry on with the other sources) from a bug. Messages
 * must never include request URLs, because several providers take the API key as a query parameter.
 *
 * <p>{@link #reason()} is the short phrase shown to the user; the message is for the log.
 */
public class NewsSourceException extends RuntimeException {

    public static final String RATE_LIMITED = "rate limited";
    public static final String UNAVAILABLE = "temporarily unavailable";

    private final String reason;

    public NewsSourceException(String reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = reason;
    }

    public String reason() {
        return reason;
    }
}

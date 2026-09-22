package com.bnyexercise.newsight.news;

import org.springframework.http.HttpStatus;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

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

    /**
     * Wraps whatever the HTTP client threw, which every source does identically: a 429 is the one
     * the user can act on, so it is named separately; everything else — a 4xx, a 5xx, a timeout, a
     * DNS failure — is indistinguishable to them.
     *
     * @param provider names the source in the log message only, never in {@link #reason()}
     */
    static NewsSourceException from(String provider, RestClientException cause) {
        String reason =
                cause instanceof RestClientResponseException response
                                && response.getStatusCode().isSameCodeAs(HttpStatus.TOO_MANY_REQUESTS)
                        ? RATE_LIMITED
                        : UNAVAILABLE;
        // getMessage(), not the exception itself: Spring's messages carry no query string, and the
        // API key travels in one for every keyed provider.
        return new NewsSourceException(
                reason, provider + " request failed: " + cause.getMessage(), cause);
    }

    public String reason() {
        return reason;
    }
}

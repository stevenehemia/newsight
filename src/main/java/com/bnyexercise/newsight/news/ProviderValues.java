package com.bnyexercise.newsight.news;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import org.springframework.util.StringUtils;

/**
 * Reading awkward values out of a provider's JSON.
 *
 * <p>Every source needs both of these and they were written three times over. They live here rather
 * than on a shared base class because the sources have nothing else in common — each one's search
 * differs in its parameters, its response shape and its quirks, and inheriting to share two helpers
 * would couple them for no gain.
 */
final class ProviderValues {

    private ProviderValues() {}

    /**
     * Parses an ISO-8601 timestamp, or returns null if the provider sent something unparseable.
     *
     * <p>Null rather than throwing: one malformed date should cost that article, not the whole
     * search. Callers drop the article, since a result with no date cannot be sorted or shown.
     */
    static Instant parseInstant(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    /**
     * Null for a field that is present but empty. Providers are inconsistent about which they send
     * — the Guardian's byline can be {@code ""} rather than absent — and the UI decides whether to
     * render a field by checking for null.
     */
    static String blankToNull(String value) {
        return StringUtils.hasText(value) ? value : null;
    }
}

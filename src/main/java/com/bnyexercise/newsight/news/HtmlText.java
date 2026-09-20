package com.bnyexercise.newsight.news;

import java.util.regex.Pattern;
import org.springframework.web.util.HtmlUtils;

/**
 * Turns a provider's HTML snippet into plain text.
 *
 * <p>The frontend renders summaries as text — deliberately, since some of this is user-submitted
 * content and rendering it as markup would be an injection risk — so markup has to be flattened
 * before it leaves a source. Hacker News story text is HTML, and Guardian trail text can be.
 */
final class HtmlText {

    private static final Pattern TAGS = Pattern.compile("<[^>]+>");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private HtmlText() {}

    /**
     * Returns the readable text of {@code html}, or null if there was nothing but markup.
     *
     * <p>Tags are removed before entities are decoded, so a decoded {@code &lt;} cannot turn into a
     * tag afterwards.
     */
    static String toPlainText(String html) {
        if (html == null) {
            return null;
        }
        // A space, not an empty string: "one<p>two" should not become "onetwo".
        String withoutTags = TAGS.matcher(html).replaceAll(" ");
        String collapsed = WHITESPACE.matcher(HtmlUtils.htmlUnescape(withoutTags)).replaceAll(" ").trim();
        return collapsed.isEmpty() ? null : collapsed;
    }
}

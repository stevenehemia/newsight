package com.bnyexercise.newsight.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Hands client-side routes back to the single-page app.
 *
 * <p>The React bundle is baked into {@code static/}, so Spring serves {@code /} from
 * {@code index.html} and {@code /?q=climate} along with it — a query string does not change the
 * path. A path like {@code /bookmarks} is different: there is no such file, so without this the
 * server answers a Whitelabel 404 and the page fails to load on a refresh or a shared link.
 *
 * <p>Deliberately <strong>one mapping per route</strong> rather than a catch-all forward. A
 * catch-all would turn every typo into the app, so a mistyped {@code /api/news/serch} would render
 * the UI instead of failing, and a genuine 404 could never be told from a routing mistake. There
 * are two pages; listing them costs a line each and keeps every other path honest.
 *
 * <p>Vite's dev server does this fallback by itself, so a missing mapping here breaks only the
 * packaged jar — which is exactly the kind of difference that reaches production unnoticed.
 * {@code ClientRoutesTest} is the guard.
 */
@Controller
class ClientRoutes {

    /** Both spellings, because a browser or a pasted link can carry the trailing slash. */
    @GetMapping({"/bookmarks", "/bookmarks/"})
    String bookmarks() {
        return "forward:/index.html";
    }
}

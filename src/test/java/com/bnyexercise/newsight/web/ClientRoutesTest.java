package com.bnyexercise.newsight.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Guards the one thing that cannot be caught in development: Vite's dev server forwards unknown
 * paths to the app by itself, so a missing mapping here breaks the packaged jar only. Verified
 * against a running jar on 2026-09-21 — {@code /bookmarks} answered a Whitelabel 404 before this
 * controller existed.
 */
@WebMvcTest(ClientRoutes.class)
class ClientRoutesTest {

    @Autowired private MockMvc mockMvc;

    @Test
    void forwardsTheBookmarksPathToTheApp() throws Exception {
        mockMvc.perform(get("/bookmarks"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
    }

    @Test
    void forwardsTheTrailingSlashSpellingToo() throws Exception {
        mockMvc.perform(get("/bookmarks/"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
    }
}

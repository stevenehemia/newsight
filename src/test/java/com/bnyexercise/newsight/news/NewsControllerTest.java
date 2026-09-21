package com.bnyexercise.newsight.news;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Boots only the web layer — no Tomcat, no port, and crucially no call to the real Hacker News API,
 * so these run fast and offline.
 */
@WebMvcTest(NewsController.class)
class NewsControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private NewsService newsService;

    @MockitoBean private TimelineService timelineService;

    @Test
    void returnsArticlesForQuery() throws Exception {
        given(newsService.search("spring"))
                .willReturn(
                        new SearchResults(
                                List.of(
                                        new Article(
                                                "Spring Boot 4 released",
                                                "Hacker News",
                                                "someuser",
                                                "A summary",
                                                "https://example.com/spring-boot-4",
                                                Instant.parse("2026-09-17T10:15:30Z"),
                                                null)),
                                List.of(),
                                List.of()));

        mockMvc.perform(get("/api/news/search").param("q", "spring"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.articles[0].title").value("Spring Boot 4 released"))
                .andExpect(jsonPath("$.articles[0].source").value("Hacker News"))
                .andExpect(jsonPath("$.articles[0].author").value("someuser"))
                .andExpect(jsonPath("$.articles[0].url").value("https://example.com/spring-boot-4"));
    }

    @Test
    void returnsEmptyArrayWhenNothingFound() throws Exception {
        given(newsService.search(any())).willReturn(new SearchResults(List.of(), List.of(), List.of()));

        mockMvc.perform(get("/api/news/search").param("q", "zzzznomatches"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.articles").isArray())
                .andExpect(jsonPath("$.articles").isEmpty());
    }

    @Test
    void reportsUnavailableSourcesAlongsideTheArticlesItHas() throws Exception {
        given(newsService.search(any()))
                .willReturn(
                        new SearchResults(
                                List.of(),
                                List.of(),
                                List.of(new SearchResults.SourceNote("The New York Times", "rate limited"))));

        mockMvc.perform(get("/api/news/search").param("q", "spring"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unavailable[0].source").value("The New York Times"))
                .andExpect(jsonPath("$.unavailable[0].reason").value("rate limited"));
    }

    @Test
    void returnsServiceUnavailableWithTheReasonsWhenEverySourceFails() throws Exception {
        given(newsService.search(any()))
                .willThrow(
                        new NewsUnavailableException(
                                new SearchResults(
                                        List.of(),
                                        List.of(),
                                        List.of(
                                                new SearchResults.SourceNote("The Guardian", "rate limited"),
                                                new SearchResults.SourceNote(
                                                        "Hacker News", "temporarily unavailable")))));

        mockMvc.perform(get("/api/news/search").param("q", "spring"))
                .andExpect(status().isServiceUnavailable())
                // The body matters: a bare 503 would leave the UI unable to say what failed.
                .andExpect(jsonPath("$.articles").isEmpty())
                .andExpect(jsonPath("$.unavailable[0].source").value("The Guardian"))
                .andExpect(jsonPath("$.unavailable[0].reason").value("rate limited"))
                .andExpect(jsonPath("$.unavailable[1].source").value("Hacker News"));
    }

    @Test
    void returnsWeeklyCountsForTheTimeline() throws Exception {
        given(timelineService.weekly(eq("climate"), anyInt(), any()))
                .willReturn(
                        new Timeline(
                                "Hacker News",
                                List.of(
                                        new Timeline.Week(
                                                Instant.parse("2026-09-07T00:00:00Z"),
                                                Instant.parse("2026-09-14T00:00:00Z"),
                                                12),
                                        new Timeline.Week(
                                                Instant.parse("2026-09-14T00:00:00Z"),
                                                Instant.parse("2026-09-21T00:00:00Z"),
                                                31))));

        mockMvc.perform(get("/api/news/timeline").param("q", "climate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("Hacker News"))
                .andExpect(jsonPath("$.weeks[0].count").value(12))
                .andExpect(jsonPath("$.weeks[1].count").value(31));
    }

    @Test
    void appliesTheSameValidationToTheTimeline() throws Exception {
        mockMvc.perform(get("/api/news/timeline").param("q", "  ")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/news/timeline").param("q", "x".repeat(201)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAQueryLongerThanTheProvidersAccept() throws Exception {
        mockMvc.perform(get("/api/news/search").param("q", "x".repeat(201)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void acceptsAQueryAtTheLimit() throws Exception {
        given(newsService.search(any())).willReturn(new SearchResults(List.of(), List.of(), List.of()));

        mockMvc.perform(get("/api/news/search").param("q", "x".repeat(200)))
                .andExpect(status().isOk());
    }

    @Test
    void rejectsBlankQuery() throws Exception {
        mockMvc.perform(get("/api/news/search").param("q", "   ")).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsMissingQueryParameter() throws Exception {
        mockMvc.perform(get("/api/news/search")).andExpect(status().isBadRequest());
    }
}

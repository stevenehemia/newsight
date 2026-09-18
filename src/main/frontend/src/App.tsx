import { useState, type FormEvent } from 'react'

/** Mirrors the Article record returned by GET /api/news/search. */
type Article = {
  title: string
  source: string
  author: string | null
  summary: string | null
  url: string
  publishedAt: string
}

export default function App() {
  const [query, setQuery] = useState('')
  const [articles, setArticles] = useState<Article[]>([])

  async function search(event: FormEvent) {
    event.preventDefault()
    const response = await fetch(`/api/news/search?q=${encodeURIComponent(query)}`)
    setArticles(await response.json())
  }

  return (
    <main>
      <h1>Newsight</h1>

      <form onSubmit={search}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search news"
        />
        <button type="submit">Search</button>
      </form>

      <ul>
        {articles.map((article, index) => (
          <li key={`${article.url}-${index}`}>
            <a href={article.url} target="_blank" rel="noreferrer">
              {article.title}
            </a>
            <div className="meta">
              {article.source}
              {article.author && ` · ${article.author}`}
              {` · ${new Date(article.publishedAt).toLocaleDateString()}`}
            </div>
            {/* Hacker News link posts have no body text, so summary is usually null. */}
            {article.summary && <p>{article.summary}</p>}
          </li>
        ))}
      </ul>
    </main>
  )
}

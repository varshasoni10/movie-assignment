import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FilterBar from '../components/FilterBar.jsx';
import MovieGrid from '../components/MovieGrid.jsx';
import { EmptyState, ErrorState, GridSkeleton, StaleBanner } from '../components/States.jsx';
import { useMovieList } from '../hooks/useMovies.js';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';
import { useScrollRestoration } from '../hooks/useScrollRestoration.js';

export default function BrowsePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const search = params.toString();

  // The URL is the single source of truth for filters => shareable, and Back/Forward just work.
  const filters = useMemo(() => {
    const p = new URLSearchParams(search);
    return { query: p.get('q') ?? '', genre: p.get('genre') ?? '', year: p.get('year') ?? '', sort: p.get('sort') ?? 'popularity' };
  }, [search]);

  const list = useMovieList(filters);
  const { items, isPending, isError, error, isPlaceholderData, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, refetch } = list;

  useScrollRestoration(!isPending);
  const sentinel = useInfiniteScroll({
    hasNextPage,
    isFetching: list.isFetching,
    isError: isFetchNextPageError,
    fetchNextPage,
    itemCount: items.length,
  });

  const change = useCallback(
    (patch) => {
      const next = new URLSearchParams(search);
      for (const [k, v] of Object.entries(patch)) {
        const key = k === 'query' ? 'q' : k;
        if (v && !(key === 'sort' && v === 'popularity')) next.set(key, v);
        else next.delete(key);
      }
      setParams(next, { replace: true });
      window.scrollTo(0, 0);
    },
    [search, setParams],
  );

  const heading = filters.query ? `Results for “${filters.query}”` : 'Discover movies';

  return (
    <main className="page">
      <h1 className="page-title">{heading}</h1>
      <FilterBar filters={filters} onChange={change} onReset={() => navigate('/', { replace: true })} />

      {list.stale && <StaleBanner />}

      {isPending ? (
        <GridSkeleton />
      ) : isError && items.length === 0 ? (
        <ErrorState error={error} onRetry={refetch} title="We couldn't load movies" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No movies found"
          action={
            <button className="btn" onClick={() => navigate('/', { replace: true })}>
              Clear search and filters
            </button>
          }
        >
          Try a different title, or remove a filter.
        </EmptyState>
      ) : (
        <>
          <p className="count" aria-live="polite">
            {list.total.toLocaleString()} {list.total === 1 ? 'movie' : 'movies'}
          </p>
          <MovieGrid movies={items} dimmed={isPlaceholderData} />
          <div ref={sentinel} className="sentinel" aria-hidden="true" />
          <div className="more">
            {isFetchingNextPage && <span className="spinner" role="status">Loading more…</span>}
            {isFetchNextPageError && (
              <div role="alert">
                <p>Couldn't load more movies.</p>
                <button className="btn" onClick={() => fetchNextPage()}>
                  Retry
                </button>
              </div>
            )}
            {!hasNextPage && !isFetchNextPageError && <p className="end">That's everything for now.</p>}
          </div>
        </>
      )}
    </main>
  );
}

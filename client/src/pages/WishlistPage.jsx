import { Link } from 'react-router-dom';
import MovieGrid from '../components/MovieGrid.jsx';
import { EmptyState, ErrorState, GridSkeleton } from '../components/States.jsx';
import { useWishlistList } from '../hooks/useWishlist.js';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';

export default function WishlistPage() {
  const list = useWishlistList();
  const { items, isPending, isError, error, refetch, hasNextPage, isFetchNextPageError, isFetchingNextPage, fetchNextPage } = list;
  const sentinel = useInfiniteScroll({ hasNextPage, isFetching: list.isFetching, isError: isFetchNextPageError, fetchNextPage, itemCount: items.length });

  return (
    <main className="page">
      <h1 className="page-title">Your wishlist</h1>
      {isPending ? (
        <GridSkeleton count={6} />
      ) : isError && items.length === 0 ? (
        <ErrorState error={error} onRetry={refetch} title="We couldn't load your wishlist" />
      ) : items.length === 0 ? (
        <EmptyState
          title="Your wishlist is empty"
          action={
            <Link className="btn btn-primary" to="/">
              Discover movies
            </Link>
          }
        >
          Tap the heart on any movie to save it here for later.
        </EmptyState>
      ) : (
        <>
          <p className="count">{items.length}{hasNextPage ? '+' : ''} saved</p>
          <MovieGrid movies={items} />
          <div ref={sentinel} className="sentinel" aria-hidden="true" />
          <div className="more">
            {isFetchingNextPage && <span className="spinner" role="status">Loading more…</span>}
            {isFetchNextPageError && (
              <button className="btn" onClick={() => fetchNextPage()}>
                Couldn't load more. Retry
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}

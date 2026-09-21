import { useCallback } from 'react';
import MovieCard from './MovieCard.jsx';
import { useToggleWishlist, useWishlistIds } from '../hooks/useWishlist.js';

/** Shared by Browse and Wishlist. Wishlist state is looked up here so cards stay dumb and memoizable. */
export default function MovieGrid({ movies, dimmed }) {
  const { ids } = useWishlistIds();
  const { mutate } = useToggleWishlist();
  const toggle = useCallback((movie, add) => mutate({ movie, add }), [mutate]);

  return (
    <ul className={`grid ${dimmed ? 'dimmed' : ''}`} aria-busy={dimmed}>
      {movies.map((m) => (
        <MovieCard key={m.id} movie={m} wished={ids.has(m.id)} onToggle={toggle} />
      ))}
    </ul>
  );
}

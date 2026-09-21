import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import WishlistButton from './WishlistButton.jsx';

export function Poster({ url, title, className = '' }) {
  const [failed, setFailed] = useState(false);
  // Fixed 2:3 box + object-fit: cover keeps the grid aligned whatever the source image dimensions are.
  return (
    <div className={`poster ${className}`}>
      {url && !failed ? (
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <div className="poster-fallback" role="img" aria-label={`No poster for ${title}`}>
          <span>{title}</span>
        </div>
      )}
    </div>
  );
}

function MovieCard({ movie, wished, onToggle }) {
  return (
    <li className="card">
      <Link to={`/movie/${movie.id}`} state={{ summary: movie }} className="card-link" title={movie.title}>
        <Poster url={movie.posterUrl} title={movie.title} />
        <h3 className="card-title">{movie.title}</h3>
        <p className="card-meta">
          <span>{movie.year ?? 'Year unknown'}</span>
          {movie.rating != null && <span className="rating">★ {movie.rating.toFixed(1)}</span>}
        </p>
      </Link>
      <WishlistButton movie={movie} wished={wished} onToggle={onToggle} className="card-heart" />
    </li>
  );
}

export default memo(MovieCard);

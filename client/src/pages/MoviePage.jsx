import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Poster } from '../components/MovieCard.jsx';
import WishlistButton from '../components/WishlistButton.jsx';
import { ErrorState, StaleBanner } from '../components/States.jsx';
import { useMovie } from '../hooks/useMovies.js';
import { useToggleWishlist, useWishlistIds } from '../hooks/useWishlist.js';

const formatRuntime = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;

export default function MoviePage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { ids } = useWishlistIds();
  const { mutate } = useToggleWishlist();
  const { data, isError, error, refetch, isPlaceholderData } = useMovie(id, location.state?.summary);

  // "Back" returns to the exact list (filters, scroll) when we arrived from inside the app.
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/'));

  if (isError && !data) {
    return (
      <main className="page">
        <button className="btn btn-ghost" onClick={goBack}>← Back</button>
        <ErrorState
          title={error.status === 404 ? 'Movie not found' : "We couldn't load this movie"}
          error={error}
          onRetry={error.status === 404 ? undefined : refetch}
        />
      </main>
    );
  }
  if (!data) {
    return (
      <main className="page" aria-busy="true">
        <div className="detail">
          <div className="poster skeleton detail-poster" />
          <div>
            <div className="skeleton line" style={{ height: 36, width: '60%' }} />
            <div className="skeleton line" />
            <div className="skeleton line short" />
          </div>
        </div>
      </main>
    );
  }

  const movie = data;
  const full = !isPlaceholderData;

  return (
    <main className="page detail-page">
      {movie.backdropUrl && <div className="backdrop" style={{ backgroundImage: `url(${movie.backdropUrl})` }} aria-hidden="true" />}
      <button className="btn btn-ghost" onClick={goBack}>← Back</button>
      {movie.stale && <StaleBanner />}
      <article className="detail">
        <Poster url={movie.posterUrl} title={movie.title} className="detail-poster" />
        <div className="detail-body">
          <h1>
            {movie.title} {movie.year && <span className="year">({movie.year})</span>}
          </h1>
          {movie.tagline && <p className="tagline">{movie.tagline}</p>}
          <p className="facts">
            {movie.rating != null && <span className="rating">★ {movie.rating.toFixed(1)}</span>}
            {movie.runtime && <span>{formatRuntime(movie.runtime)}</span>}
            {movie.status && movie.status !== 'Released' && <span>{movie.status}</span>}
          </p>
          {movie.genres?.length > 0 && (
            <ul className="tags">
              {movie.genres.map((g) => (
                <li key={g.id}>
                  <Link to={`/?genre=${g.id}`} className="chip">{g.name}</Link>
                </li>
              ))}
            </ul>
          )}
          <div className="actions">
            <WishlistButton movie={movie} wished={ids.has(movie.id)} onToggle={(m, add) => mutate({ movie: m, add })} className="btn btn-primary" label />
            {movie.trailerUrl && (
              <a className="btn" href={movie.trailerUrl} target="_blank" rel="noreferrer noopener">▶ Watch trailer</a>
            )}
          </div>
          <h2>Overview</h2>
          <p className="overview">{movie.overview ?? 'No overview is available for this movie yet.'}</p>
          {full && movie.director && (
            <p className="director">
              <strong>Director:</strong> {movie.director}
            </p>
          )}
          {!full && <p className="muted" role="status">Loading full details…</p>}
        </div>
      </article>

      {full && movie.cast?.length > 0 && (
        <section>
          <h2>Cast</h2>
          <ul className="cast">
            {movie.cast.map((p) => (
              <li key={p.id}>
                <div className="avatar">
                  {p.photoUrl ? <img src={p.photoUrl} alt="" loading="lazy" /> : <span aria-hidden="true">{p.name[0]}</span>}
                </div>
                <strong>{p.name}</strong>
                {p.character && <span className="muted">{p.character}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

export default function WishlistButton({ movie, wished, onToggle, className = '', label }) {
  const text = wished ? 'Remove from wishlist' : 'Add to wishlist';
  return (
    <button
      type="button"
      className={`heart ${wished ? 'on' : ''} ${className}`}
      aria-pressed={wished}
      aria-label={`${text}: ${movie.title}`}
      title={text}
      onClick={() => onToggle(movie, !wished)}
    >
      <span aria-hidden="true">{wished ? '♥' : '♡'}</span>
      {label && <span className="heart-label">{wished ? 'In wishlist' : 'Add to wishlist'}</span>}
    </button>
  );
}

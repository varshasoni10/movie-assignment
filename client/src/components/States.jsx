export function GridSkeleton({ count = 12 }) {
  return (
    <ul className="grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="card">
          <div className="poster skeleton" />
          <div className="skeleton line" />
          <div className="skeleton line short" />
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="state">
      <div className="state-icon" aria-hidden="true">🎞️</div>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  return (
    <div className="state state-error" role="alert">
      <div className="state-icon" aria-hidden="true">⚠️</div>
      <h2>{title}</h2>
      <p>{error?.message ?? 'Please try again.'}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function StaleBanner() {
  return (
    <div className="banner" role="status">
      Live data is temporarily unavailable. Showing previously loaded results.
    </div>
  );
}

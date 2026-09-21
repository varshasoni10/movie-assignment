import { useMeta } from '../hooks/useMovies.js';

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR + 1 - 1920 + 1 }, (_, i) => THIS_YEAR + 1 - i);

export default function FilterBar({ filters, onChange, onReset }) {
  const { data } = useMeta();
  const searching = Boolean(filters.query);
  const hasFilters = filters.genre || filters.year || filters.sort !== 'popularity' || filters.query;

  return (
    <section className="filters" aria-label="Filters">
      {data?.genres && (
        <div className="chips" role="group" aria-label="Genre">
          <button className={`chip ${!filters.genre ? 'on' : ''}`} aria-pressed={!filters.genre} onClick={() => onChange({ genre: '' })}>
            All
          </button>
          {data.genres.map((g) => (
            <button
              key={g.id}
              className={`chip ${filters.genre === String(g.id) ? 'on' : ''}`}
              aria-pressed={filters.genre === String(g.id)}
              onClick={() => onChange({ genre: filters.genre === String(g.id) ? '' : String(g.id) })}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}
      <div className="selects">
        <label>
          <span>Sort by</span>
          <select value={searching ? 'relevance' : filters.sort} disabled={searching} onChange={(e) => onChange({ sort: e.target.value })}>
            {searching && <option value="relevance">Relevance</option>}
            {(data?.sorts ?? [{ id: 'popularity', label: 'Most popular' }]).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Year</span>
          <select value={filters.year} onChange={(e) => onChange({ year: e.target.value })}>
            <option value="">Any year</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button className="btn btn-ghost" onClick={onReset}>
            Reset
          </button>
        )}
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useWishlistIds } from '../hooks/useWishlist.js';

const DEBOUNCE_MS = 350;

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { count } = useWishlistIds();

  const urlQuery = pathname === '/' ? (params.get('q') ?? '') : '';
  const [text, setText] = useState(urlQuery);
  const timer = useRef();
  const lastCommitted = useRef(urlQuery);

  // URL -> input (back/forward, clearing filters). Ignored when the URL change is our own commit.
  useEffect(() => {
    if (urlQuery !== lastCommitted.current) {
      clearTimeout(timer.current);
      lastCommitted.current = urlQuery;
      setText(urlQuery);
    }
  }, [urlQuery]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function commit(value) {
    const q = value.trim().replace(/\s+/g, ' ');
    if (q === lastCommitted.current) return;
    lastCommitted.current = q;
    const next = new URLSearchParams(pathname === '/' ? params : undefined);
    if (q) next.set('q', q);
    else next.delete('q');
    const search = next.toString();
    // Typing while already browsing REPLACES the history entry, so Back doesn't replay every keystroke.
    navigate({ pathname: '/', search: search ? `?${search}` : '' }, { replace: pathname === '/' });
  }

  function onChange(e) {
    setText(e.target.value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(e.target.value), DEBOUNCE_MS);
  }

  function onSubmit(e) {
    e.preventDefault();
    clearTimeout(timer.current);
    commit(text);
  }

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="brand">
          <span aria-hidden="true">🎬</span> Reel
        </Link>
        <form className="search" role="search" onSubmit={onSubmit}>
          <input
            type="search"
            value={text}
            onChange={onChange}
            placeholder="Search movies…"
            aria-label="Search movies"
            maxLength={100}
            autoComplete="off"
          />
        </form>
        <nav className="nav">
          <NavLink to="/" end>
            Discover
          </NavLink>
          <NavLink to="/wishlist">
            Wishlist
            {count > 0 && <span className="badge">{count}</span>}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

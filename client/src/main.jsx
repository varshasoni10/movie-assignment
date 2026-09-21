import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/Toast.jsx';
import { EmptyState } from './components/States.jsx';
import Header from './components/Header.jsx';
import BrowsePage from './pages/BrowsePage.jsx';
import MoviePage from './pages/MoviePage.jsx';
import WishlistPage from './pages/WishlistPage.jsx';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000, // matches the server cache: returning to a list is instant and request-free
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      // One retry for server/network trouble; never retry a 4xx (it will not change).
      retry: (count, err) => count < 1 && !(err?.status >= 400 && err.status < 500 && err.status !== 429),
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Header />
          <Routes>
            <Route path="/" element={<BrowsePage />} />
            <Route path="/movie/:id" element={<MoviePage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route
              path="*"
              element={
                <main className="page">
                  <EmptyState title="Page not found" action={<Link className="btn" to="/">Go home</Link>} />
                </main>
              }
            />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);

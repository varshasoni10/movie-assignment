export const PAGE_SIZE = 20;
export const MAX_PAGE = 500; // TMDB refuses pages beyond 500

// Public sort keys exposed by OUR API. Providers map them to whatever the upstream understands.
export const SORTS = {
  popularity: 'Most popular',
  rating: 'Highest rated',
  newest: 'Newest',
  oldest: 'Oldest',
  title: 'Title A–Z',
};
export const DEFAULT_SORT = 'popularity';

export const GENRES = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];

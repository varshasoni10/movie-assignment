import { useMemo } from 'react';
import { useInfiniteQuery, useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../api/client.js';

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: ({ signal }) => api.meta(signal), staleTime: Infinity, retry: 2 });
}

/** Merge pages into one list; upstream pagination can repeat an item across page boundaries. */
function flatten(pages) {
  const seen = new Set();
  const items = [];
  for (const p of pages ?? []) {
    for (const m of p.items) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        items.push(m);
      }
    }
  }
  return items;
}

export function useMovieList(filters) {
  const q = useInfiniteQuery({
    // The filters ARE the cache key: switching back to an earlier search is instant and request-free.
    queryKey: ['movies', filters],
    // react-query passes an AbortSignal; superseded requests (fast typing / filter changes) are cancelled.
    queryFn: ({ pageParam, signal }) => api.movies({ ...filters, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData, // keep showing old results (dimmed) while new ones load
  });
  const items = useMemo(() => flatten(q.data?.pages), [q.data]);
  return {
    ...q,
    items,
    total: q.data?.pages[0]?.totalResults ?? 0,
    stale: q.data?.pages.some((p) => p.stale) ?? false,
  };
}

export function useMovie(id, initial) {
  return useQuery({
    queryKey: ['movie', id],
    queryFn: ({ signal }) => api.movie(id, signal),
    placeholderData: initial, // summary from the list shows immediately while details load
    retry: (n, err) => n < 1 && err.status !== 404,
  });
}

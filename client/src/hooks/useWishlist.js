import { useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useToast } from '../components/Toast.jsx';

const IDS = ['wishlist', 'ids'];
const LIST = ['wishlist', 'list'];

export function useWishlistIds() {
  const q = useQuery({ queryKey: IDS, queryFn: ({ signal }) => api.wishlistIds(signal).then((r) => r.ids), staleTime: 60_000 });
  const set = useMemo(() => new Set(q.data ?? []), [q.data]);
  return { ids: set, count: set.size, isLoading: q.isLoading };
}

export function useWishlistList() {
  const q = useInfiniteQuery({
    queryKey: LIST,
    queryFn: ({ pageParam, signal }) => api.wishlist(pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    staleTime: 0,
  });
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  return { ...q, items };
}

/** Optimistic add/remove: the heart flips instantly and rolls back (with a toast) if the server refuses. */
export function useToggleWishlist() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ movie, add }) => (add ? api.addToWishlist(movie.id) : api.removeFromWishlist(movie.id)),
    onMutate: async ({ movie, add }) => {
      await qc.cancelQueries({ queryKey: ['wishlist'] });
      const prevIds = qc.getQueryData(IDS);
      const prevList = qc.getQueryData(LIST);
      qc.setQueryData(IDS, (ids = []) => (add ? [...new Set([movie.id, ...ids])] : ids.filter((i) => i !== movie.id)));
      if (!add) {
        qc.setQueryData(LIST, (d) => d && { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.filter((m) => m.id !== movie.id) })) });
      }
      return { prevIds, prevList };
    },
    onError: (err, { add }, ctx) => {
      qc.setQueryData(IDS, ctx.prevIds);
      qc.setQueryData(LIST, ctx.prevList);
      toast(`Could not ${add ? 'add to' : 'remove from'} wishlist. ${err.message}`, 'error');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: IDS });
      qc.invalidateQueries({ queryKey: LIST });
    },
  });
}

import { useEffect, useRef } from 'react';

/**
 * Attach the returned ref to a sentinel element below the list. Loads the next page when it nears the
 * viewport. Also re-checks after every page: if a page was short (e.g. filtered results) the sentinel may
 * still be in view without ever "re-entering", which IntersectionObserver alone would not report.
 */
export function useInfiniteScroll({ hasNextPage, isFetching, isError, fetchNextPage, itemCount }) {
  const ref = useRef(null);
  const canLoad = hasNextPage && !isFetching && !isError;

  useEffect(() => {
    const el = ref.current;
    if (!el || !canLoad) return;
    const nearViewport = () => el.getBoundingClientRect().top < window.innerHeight + 800;
    if (nearViewport()) {
      fetchNextPage();
      return;
    }
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && fetchNextPage(), { rootMargin: '800px' });
    io.observe(el);
    return () => io.disconnect();
  }, [canLoad, fetchNextPage, itemCount]);

  return ref;
}

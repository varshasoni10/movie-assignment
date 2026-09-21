export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
  get isNetwork() {
    return this.code === 'NETWORK';
  }
}

// Wishlists are per-browser: an anonymous id generated once and sent with every wishlist request.
let memoryId;
function getClientId() {
  try {
    let id = localStorage.getItem('reel:clientId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('reel:clientId', id);
    }
    return id;
  } catch {
    return (memoryId ??= crypto.randomUUID()); // storage blocked: works for this session only
  }
}

async function request(path, { signal, method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      headers: { 'X-Client-Id': getClientId(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err; // cancellations are not errors to display
    throw new ApiError('Cannot reach the server. Check your connection and try again.', { code: 'NETWORK' });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error?.message ?? 'Something went wrong. Please try again.', {
      status: res.status,
      code: data?.error?.code ?? 'HTTP',
    });
  }
  return data;
}

const qs = (params) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const api = {
  movies: (params, signal) => request(`/movies${qs(params)}`, { signal }),
  movie: (id, signal) => request(`/movies/${id}`, { signal }),
  meta: (signal) => request('/genres', { signal }),
  wishlist: (offset, signal) => request(`/wishlist${qs({ offset, limit: 24 })}`, { signal }),
  wishlistIds: (signal) => request('/wishlist/ids', { signal }),
  addToWishlist: (movieId) => request('/wishlist', { method: 'POST', body: { movieId } }),
  removeFromWishlist: (movieId) => request(`/wishlist/${movieId}`, { method: 'DELETE' }),
};

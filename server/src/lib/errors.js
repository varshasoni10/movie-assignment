/** Error that is safe to show to API clients. */
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Failure talking to the third-party API. Carries enough info to decide whether to retry. */
export class UpstreamError extends Error {
  constructor(message, { status = 0, retryable = false, retryAfterMs = 0, cause } = {}) {
    super(message, { cause });
    this.status = status;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Translate anything thrown by the service layer into an AppError. */
export function toAppError(err) {
  if (err instanceof AppError) return err;
  if (err instanceof UpstreamError) {
    if (err.status === 404) return new AppError(404, 'NOT_FOUND', 'Movie not found.');
    if (err.status === 429) {
      return new AppError(503, 'UPSTREAM_RATE_LIMITED', 'The movie service is busy. Please try again shortly.');
    }
    if (err.message === 'timeout') {
      return new AppError(504, 'UPSTREAM_TIMEOUT', 'The movie service took too long to respond.');
    }
    return new AppError(502, 'UPSTREAM_UNAVAILABLE', 'The movie service is temporarily unavailable.');
  }
  return new AppError(500, 'INTERNAL', 'Something went wrong.');
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
}

/** An error response's body; only `message` is read. */
export interface ErrorBody {
  message?: unknown;
}

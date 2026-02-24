export interface ApiError {
  code: string;
  details?: unknown;
}

export interface ApiResponseEnvelope<T = unknown> {
  status: 'success' | 'fail';
  message: string;
  data: T;
  error?: ApiError;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function buildSkipTake(page: number, limit: number): { skip: number; take: number } {
  const normalizedPage = Math.max(1, page);
  const normalizedLimit = Math.min(MAX_LIMIT, Math.max(1, limit));
  return {
    skip: (normalizedPage - 1) * normalizedLimit,
    take: normalizedLimit,
  };
}

export function normalizePaginationParams(params: PaginationParams): {
  page: number;
  limit: number;
} {
  return {
    page: Math.max(1, params.page ?? DEFAULT_PAGE),
    limit: Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT)),
  };
}

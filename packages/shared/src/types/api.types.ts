export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  meta?: ApiMeta;
  errors?: ApiError[];
  requestId?: string;
  timestamp: string;
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  cursor?: string;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: Required<ApiMeta>;
}

export interface BulkOperationResult<T = unknown> {
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
  results: T[];
}

export type SortOrder = 'asc' | 'desc';

export interface SortOptions {
  field: string;
  order: SortOrder;
}

export interface FilterOptions {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn'
  | 'isNull'
  | 'isNotNull'
  | 'between';

export interface QueryOptions {
  page?: number;
  limit?: number;
  sort?: SortOptions[];
  filters?: FilterOptions[];
  search?: string;
  cursor?: string;
  include?: string[];
}

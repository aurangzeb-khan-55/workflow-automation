export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

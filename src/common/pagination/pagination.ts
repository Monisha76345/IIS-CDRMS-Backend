export type PaginationMeta = {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
};

export type PaginatedResult<T> = {
  items: T[];
  meta: PaginationMeta;
};

export type PaginationInput = {
  page?: number;
  limit?: number;
  search?: string;
};

/** Default page size matches CAS-style APIs (10). Cap at 100. */
export function normalizePagination(input: PaginationInput = {}) {
  const currentPage = Math.max(1, Number(input.page) || 1);
  const rawLimit = Number(input.limit);
  const itemsPerPage = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(100, Math.floor(rawLimit))
    : 10;
  const skip = (currentPage - 1) * itemsPerPage;
  return { currentPage, itemsPerPage, skip, take: itemsPerPage };
}

export function toPaginatedResult<T>(
  items: T[],
  totalItems: number,
  currentPage: number,
  itemsPerPage: number,
): PaginatedResult<T> {
  return {
    items,
    meta: {
      totalItems,
      itemCount: items.length,
      itemsPerPage,
      totalPages: itemsPerPage > 0 ? Math.ceil(totalItems / itemsPerPage) : 0,
      currentPage,
    },
  };
}

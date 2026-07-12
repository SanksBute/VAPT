export function buildOrderBy(
  sortBy?: string,
  sortOrder?: 'asc' | 'desc',
  allowedFields?: string[],
): Record<string, 'asc' | 'desc'> {
  if (sortBy === undefined || sortBy === '') {
    return { createdAt: 'desc' };
  }

  if (allowedFields !== undefined && !allowedFields.includes(sortBy)) {
    return { createdAt: 'desc' };
  }

  return { [sortBy]: sortOrder ?? 'desc' };
}

export function buildSearchFilter(
  search: string | undefined,
  fields: string[],
): Record<string, unknown> | undefined {
  if (search === undefined || search.trim().length === 0) {
    return undefined;
  }

  const trimmed = search.trim();
  return {
    OR: fields.map((field) => ({
      [field]: { contains: trimmed, mode: 'insensitive' },
    })),
  };
}

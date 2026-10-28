/**
 * Normalizes inconsistent department representations (strings, { name: ... }, { title: ... })
 * safely ignoring invalid or malformed entries without crashing.
 */
export function normalizeDepartmentName(dept) {
  if (!dept) return null;
  if (typeof dept === 'string') {
    const trimmed = dept.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof dept === 'object' && dept !== null) {
    if (typeof dept.name === 'string' && dept.name.trim()) {
      return dept.name.trim();
    }
    if (typeof dept.title === 'string' && dept.title.trim()) {
      return dept.title.trim();
    }
  }
  return null;
}

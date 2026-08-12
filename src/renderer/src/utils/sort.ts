import type { UsageEntry } from '../types/index'

/**
 * Generic sort helper: sorts items by a numeric key function.
 */
export function sortBy<T>(
  items: T[],
  keyFn: (item: T) => number,
  ascending: boolean
): T[] {
  return [...items].sort((a, b) => {
    const ka = keyFn(a)
    const kb = keyFn(b)
    return ascending ? ka - kb : kb - ka
  })
}

/**
 * Sort usage entries by today's total_seconds.
 */
export function sortByTodayUsage(
  entries: UsageEntry[],
  ascending: boolean
): UsageEntry[] {
  return sortBy(entries, (e) => e.total_seconds, ascending)
}

/**
 * Sort usage entries by total usage (same field, but kept for semantic clarity).
 */
export function sortByTotalUsage(
  entries: UsageEntry[],
  ascending: boolean
): UsageEntry[] {
  return sortBy(entries, (e) => e.total_seconds, ascending)
}

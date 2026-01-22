/**
 * Usage Limit Tracker
 * 
 * Tracks the number of card generation requests for authenticated users.
 * Free tier is limited to 3 generations per account.
 */

const STORAGE_KEY = 'microscroll_usage_count'
const FREE_TIER_LIMIT = 3

export interface UsageInfo {
  count: number
  limit: number
  remaining: number
  hasReachedLimit: boolean
}

/**
 * Get current usage count from localStorage
 */
export function getUsageCount(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      return isNaN(parsed) ? 0 : parsed
    }
  } catch (e) {
    console.error('Error reading usage count:', e)
  }
  return 0
}

/**
 * Increment usage count
 */
export function incrementUsageCount(): number {
  const current = getUsageCount()
  const newCount = current + 1
  try {
    localStorage.setItem(STORAGE_KEY, String(newCount))
  } catch (e) {
    console.error('Error saving usage count:', e)
  }
  return newCount
}

/**
 * Get full usage information
 */
export function getUsageInfo(): UsageInfo {
  const count = getUsageCount()
  return {
    count,
    limit: FREE_TIER_LIMIT,
    remaining: Math.max(0, FREE_TIER_LIMIT - count),
    hasReachedLimit: count >= FREE_TIER_LIMIT,
  }
}

/**
 * Check if user has reached the free tier limit
 */
export function hasReachedLimit(): boolean {
  return getUsageCount() >= FREE_TIER_LIMIT
}

/**
 * Reset usage count (for premium users or testing)
 */
export function resetUsageCount(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.error('Error resetting usage count:', e)
  }
}

/**
 * Get the free tier limit
 */
export function getFreeLimit(): number {
  return FREE_TIER_LIMIT
}

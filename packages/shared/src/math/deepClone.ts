/**
 * deepClone — JSON-based deep clone for serialization-safe data structures.
 * Used for snapshot cloning in replay recording and seeking.
 */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

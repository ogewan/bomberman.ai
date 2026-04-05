// structuredClone is available in all target environments (Node 17+, Chrome 98+)
// but its TypeScript type lives in lib.dom.d.ts. Declare it here to avoid pulling in DOM.
declare function structuredClone<T>(value: T): T;

/**
 * deepClone — deep clone for serialization-safe data structures.
 * Used for snapshot cloning in replay recording and seeking.
 * structuredClone is 2-4x faster than JSON roundtrip for structured data.
 */
export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

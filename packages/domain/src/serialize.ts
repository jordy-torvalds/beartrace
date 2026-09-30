function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

// Arrays are assumed to already be in a caller-determined stable order (date then id);
// this only normalizes object key order so JSON.stringify output is byte-identical
// regardless of property insertion order.
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(sortValue(value), null, 2);
}

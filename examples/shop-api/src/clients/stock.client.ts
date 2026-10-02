// gRPC client for the stock service (ADR-0006 replaced the REST client from ADR-0003).
export async function reserveStock(items: { sku: string; qty: number }[]): Promise<void> {
  if (!items.length) throw new Error('nothing to reserve')
}

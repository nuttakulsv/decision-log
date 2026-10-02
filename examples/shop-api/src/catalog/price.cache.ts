// Kept only for the admin "recently viewed" widget. Prices for checkout come from the database (ADR-0008).
const cache = new Map<string, number>()
export const remember = (sku: string, price: number) => cache.set(sku, price)

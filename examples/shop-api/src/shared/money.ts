/** Amounts are integer satang (1 baht = 100 satang). See ADR-0002. */
export type Satang = number & { readonly __unit: 'satang' }

export const satang = (baht: number): Satang => Math.round(baht * 100) as Satang
export const toBaht = (amount: Satang): string => (amount / 100).toFixed(2)

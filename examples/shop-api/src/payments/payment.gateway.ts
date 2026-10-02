import type { Satang } from '../shared/money.js'

export async function charge(orderId: string, amount: Satang): Promise<{ ref: string }> {
  return { ref: `PAY-${orderId}-${amount}` }
}

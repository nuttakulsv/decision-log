import type { Satang } from '../shared/money.js'

export class OrderRepository {
  async insert(order: { customerId: string; items: unknown[]; total: Satang }) {
    // INSERT INTO orders.orders ... (schema "orders", see ADR-0004)
    return { id: crypto.randomUUID(), ...order }
  }
}

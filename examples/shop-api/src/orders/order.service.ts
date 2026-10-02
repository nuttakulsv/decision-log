import type { Satang } from '../shared/money.js'
import { reserveStock } from '../clients/stock.client.js'
import { OrderRepository } from './order.repository.js'

export class OrderService {
  constructor(private readonly orders: OrderRepository) {}

  async place(customerId: string, items: { sku: string; qty: number; price: Satang }[]) {
    await reserveStock(items.map(({ sku, qty }) => ({ sku, qty })))
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0) as Satang
    return this.orders.insert({ customerId, items, total })
  }
}

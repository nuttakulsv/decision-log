export function handlePaymentWebhook(body: { ref: string; status: 'paid' | 'failed' }) {
  return { received: body.ref, status: body.status }
}

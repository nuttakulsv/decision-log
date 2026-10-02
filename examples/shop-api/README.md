# shop-api example

A made-up backend with eight decisions, used in the main README. The code is only there so the `areas` globs have something to match.

```bash
cd examples/shop-api
npx decision-log-cli list
npx decision-log-cli affected src/clients/stock.client.ts src/orders/order.service.ts
npx decision-log-cli affected src/catalog/price.cache.ts --markdown
npx decision-log-cli site -o site && open site/index.html
```

What is in the folder:

- `0002` is written in Thai and covers money handling across three modules.
- `0003` → `0006` and `0005` → `0007` are supersede chains. Changing `src/clients/` shows both the current and the replaced decision.
- `0008` is deprecated. Touching `src/catalog/` with `fail-on-deprecated: true` fails until the PR mentions ADR-0008.

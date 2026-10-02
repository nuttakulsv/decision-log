CREATE SCHEMA orders;
CREATE SCHEMA payments;

CREATE TABLE orders.orders (
  id uuid PRIMARY KEY,
  customer_id text NOT NULL,
  total_satang bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

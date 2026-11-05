-- A direct sale paid by bank transfer needs a real order code before the payment is confirmed.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT';

import { z } from 'zod';
import {
  CashAccountTypeSchema,
  CashClosureStatusSchema,
  CashMovementTypeSchema,
  PaymentMethodSchema,
  PaymentStatusSchema,
  PaymentVarianceReasonSchema,
} from '../enums';

/**
 * docs/spec/13-inventario-caja.md §O, docs/spec/09-reglas.md R24-R31,
 * docs/spec/08-modelo-datos.md §H.2 `payments`/`cash_accounts`/`cash_movements`/
 * `cash_closures`. Todo monto en centavos enteros (R31) — nunca `number` con
 * decimales de moneda, siempre entero.
 */
export const PaymentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  serviceId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid(),
  amountCents: z.number().int(),
  currency: z.string().length(3),
  method: PaymentMethodSchema,
  status: PaymentStatusSchema,
  paidAt: z.string().datetime(),
  receivedBy: z.string().uuid(),
  receiptUrl: z.string().nullable().optional(),
  varianceReason: PaymentVarianceReasonSchema.nullable().optional(),
  reversalOfId: z.string().uuid().nullable().optional(),
  voidReason: z.string().nullable().optional(),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const PaymentListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  serviceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  method: PaymentMethodSchema.optional(),
});
export type PaymentListQuery = z.infer<typeof PaymentListQuerySchema>;

/** POST /payments — R24: si `method='CASH'`, nace con un cash_movement en la misma transacción. */
export const CreatePaymentRequestSchema = z.object({
  serviceId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).default('ARS'),
  method: PaymentMethodSchema,
  paidAt: z.string().datetime().optional(), // default: now()
  receiptUrl: z.string().url().nullable().optional(), // obligatorio en el frontend para TRANSFER (R25), no forzado acá
  clientEventId: z.string().uuid().optional(), // idempotencia (R43) cuando viene de campo
});
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;

/** POST /payments/:id/void — R26: no se edita, se anula con un asiento inverso. */
export const VoidPaymentRequestSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type VoidPaymentRequest = z.infer<typeof VoidPaymentRequestSchema>;

export const CashAccountSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  ownerName: z.string(),
  type: CashAccountTypeSchema,
  currency: z.string().length(3),
  isActive: z.boolean(),
  /** R27: calculado como Σ movimientos, nunca un campo mutable almacenado. */
  balanceCents: z.number().int(),
  openClosureId: z.string().uuid().nullable(),
});
export type CashAccount = z.infer<typeof CashAccountSchema>;

export const CashMovementSchema = z.object({
  id: z.string(), // BigInt serializado
  tenantId: z.string().uuid(),
  cashAccountId: z.string().uuid(),
  amountCents: z.number().int(), // signo: + ingreso, - egreso
  type: CashMovementTypeSchema,
  referenceType: z.string().nullable().optional(),
  referenceId: z.string().uuid().nullable().optional(),
  closureId: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  performedBy: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type CashMovement = z.infer<typeof CashMovementSchema>;

export const CashMovementListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type CashMovementListQuery = z.infer<typeof CashMovementListQuerySchema>;

/** POST /cash/accounts/:id/movements — asientos manuales (gasto, ajuste, saldo inicial). */
export const CreateCashMovementRequestSchema = z.object({
  amountCents: z.number().int().refine((v) => v !== 0, 'amountCents no puede ser 0'),
  type: z.enum(['EXPENSE', 'ADJUSTMENT', 'OPENING_BALANCE']),
  description: z.string().min(1).max(500),
});
export type CreateCashMovementRequest = z.infer<typeof CreateCashMovementRequestSchema>;

export const CashClosureSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  cashAccountId: z.string().uuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime().nullable().optional(),
  expectedCents: z.number().int().nullable().optional(),
  declaredCents: z.number().int().nullable().optional(),
  receivedCents: z.number().int().nullable().optional(),
  status: CashClosureStatusSchema,
  differenceReason: z.string().nullable().optional(),
  declaredBy: z.string().uuid().nullable().optional(),
  declaredAt: z.string().datetime().nullable().optional(),
  approvedBy: z.string().uuid().nullable().optional(),
  approvedAt: z.string().datetime().nullable().optional(),
  selfApproved: z.boolean(),
});
export type CashClosure = z.infer<typeof CashClosureSchema>;

export const CashClosureListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: CashClosureStatusSchema.optional(),
});
export type CashClosureListQuery = z.infer<typeof CashClosureListQuerySchema>;

/** POST /cash/accounts/:id/closures — el operario declara lo que rinde (R27, R28). */
export const DeclareCashClosureRequestSchema = z.object({
  declaredCents: z.number().int().nonnegative(),
});
export type DeclareCashClosureRequest = z.infer<typeof DeclareCashClosureRequestSchema>;

/**
 * POST /cash/closures/:id/reconcile — el admin cuenta y concilia (R28, R29: la
 * diferencia siempre se absorbe con un ADJUSTMENT explícito, la caja nunca arrastra
 * descuadre). `differenceReason` obligatorio si `receivedCents` difiere de lo
 * esperado.
 */
export const ReconcileCashClosureRequestSchema = z.object({
  receivedCents: z.number().int().nonnegative(),
  differenceReason: z.string().min(1).max(500).nullable().optional(),
});
export type ReconcileCashClosureRequest = z.infer<typeof ReconcileCashClosureRequestSchema>;

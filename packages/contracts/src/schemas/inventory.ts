import { z } from 'zod';
import { InventoryMovementTypeSchema, MeasurementUnitSchema, RegistryAuthoritySchema, StockLocationTypeSchema, SupplyCategorySchema } from '../enums';

/**
 * docs/spec/13-inventario-caja.md §N, docs/spec/09-reglas.md R16-R23,
 * docs/spec/08-modelo-datos.md §H.2 `supplies`/`stock_locations`/`inventory`/
 * `inventory_movements`.
 *
 * Alcance de hoy: catálogo de insumos, ubicaciones de stock (depósito + una por
 * operario), stock actual, y movimientos manuales (compra/transferencia/ajuste/
 * pérdida/devolución/baja por vencimiento). `CONSUMPTION` (R16-R18, R20: dilución,
 * lote, descuento en el vehículo del operario que ejecuta) queda para cuando exista
 * la sesión de campo (PR-207/PR-106b) — no se inventa ese flujo acá.
 */
export const SupplySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sku: z.string().min(1).max(40),
  name: z.string().min(1).max(150),
  category: SupplyCategorySchema,
  activeIngredient: z.string().max(150).nullable().optional(),
  concentration: z.string().max(60).nullable().optional(),
  registryAuthority: RegistryAuthoritySchema,
  registryNumber: z.string().min(1).max(40),
  purchaseUnit: MeasurementUnitSchema,
  applicationUnit: MeasurementUnitSchema,
  dilutionRateMlPerL: z.number().nonnegative().nullable().optional(),
  dosePerSqm: z.number().nonnegative().nullable().optional(),
  reentryHours: z.number().int().nonnegative().nullable().optional(),
  msdsUrl: z.string().url().nullable().optional(),
  unitCostCents: z.number().int().nonnegative().nullable().optional(),
  requiresLotTracking: z.boolean(),
  minStock: z.number().nonnegative().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Supply = z.infer<typeof SupplySchema>;

export const CreateSupplyRequestSchema = z.object({
  sku: z.string().min(1).max(40),
  name: z.string().min(1).max(150),
  category: SupplyCategorySchema,
  activeIngredient: z.string().max(150).nullable().optional(),
  concentration: z.string().max(60).nullable().optional(),
  registryAuthority: RegistryAuthoritySchema,
  registryNumber: z.string().min(1).max(40),
  purchaseUnit: MeasurementUnitSchema,
  applicationUnit: MeasurementUnitSchema,
  dilutionRateMlPerL: z.number().nonnegative().nullable().optional(),
  dosePerSqm: z.number().nonnegative().nullable().optional(),
  reentryHours: z.number().int().nonnegative().nullable().optional(),
  msdsUrl: z.string().url().nullable().optional(),
  unitCostCents: z.number().int().nonnegative().nullable().optional(),
  requiresLotTracking: z.boolean().default(true),
  minStock: z.number().nonnegative().nullable().optional(),
});
export type CreateSupplyRequest = z.infer<typeof CreateSupplyRequestSchema>;

export const UpdateSupplyRequestSchema = CreateSupplyRequestSchema.omit({ sku: true }).partial();
export type UpdateSupplyRequest = z.infer<typeof UpdateSupplyRequestSchema>;

export const StockLocationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: StockLocationTypeSchema,
  name: z.string().min(1).max(100),
  technicianId: z.string().uuid().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type StockLocation = z.infer<typeof StockLocationSchema>;

/** GET /inventory — proyección de saldo actual (§N.2: "la verdad son los movimientos, esto es una proyección"). */
export const InventoryBalanceSchema = z.object({
  stockLocationId: z.string().uuid(),
  stockLocationName: z.string(),
  stockLocationType: StockLocationTypeSchema,
  supplyId: z.string().uuid(),
  supplyName: z.string(),
  supplySku: z.string(),
  applicationUnit: MeasurementUnitSchema,
  lotId: z.string().uuid().nullable(),
  lotCode: z.string().nullable(),
  quantity: z.number(),
  minStock: z.number().nullable(),
  belowMinimum: z.boolean(),
});
export type InventoryBalance = z.infer<typeof InventoryBalanceSchema>;

export const InventoryListQuerySchema = z.object({
  stockLocationId: z.string().uuid().optional(),
  supplyId: z.string().uuid().optional(),
});
export type InventoryListQuery = z.infer<typeof InventoryListQuerySchema>;

export const InventoryMovementSchema = z.object({
  id: z.string(), // BigInt serializado como string (id autoincremental de movimiento append-only)
  tenantId: z.string().uuid(),
  stockLocationId: z.string().uuid(),
  supplyId: z.string().uuid(),
  lotId: z.string().uuid().nullable().optional(),
  quantityDelta: z.number(),
  type: InventoryMovementTypeSchema,
  referenceType: z.string().nullable().optional(),
  referenceId: z.string().uuid().nullable().optional(),
  reason: z.string().nullable().optional(),
  unitCostCents: z.number().int().nonnegative().nullable().optional(),
  requiresAdjustment: z.boolean(),
  performedBy: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type InventoryMovement = z.infer<typeof InventoryMovementSchema>;

export const InventoryMovementListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  stockLocationId: z.string().uuid().optional(),
  supplyId: z.string().uuid().optional(),
});
export type InventoryMovementListQuery = z.infer<typeof InventoryMovementListQuerySchema>;

/**
 * POST /inventory/movements — un solo endpoint para los movimientos manuales de hoy.
 * `PURCHASE`/`ADJUSTMENT`/`LOSS`/`RETURN`/`EXPIRY_WRITE_OFF` piden `stockLocationId`
 * (destino del signo del delta). `TRANSFER` pide `fromStockLocationId` +
 * `toStockLocationId` y genera el par espejo TRANSFER_OUT/TRANSFER_IN (R21).
 * `CONSUMPTION` no está permitido acá — nace de la sesión de campo (R16), no de un
 * alta manual del admin.
 */
export const CreateInventoryMovementRequestSchema = z
  .object({
    type: z.enum(['PURCHASE', 'TRANSFER', 'ADJUSTMENT', 'LOSS', 'RETURN', 'EXPIRY_WRITE_OFF']),
    supplyId: z.string().uuid(),
    lotCode: z.string().max(40).nullable().optional(), // si se pasa, hace get-or-create del lote
    lotId: z.string().uuid().nullable().optional(),
    // Magnitud para PURCHASE/RETURN/LOSS/EXPIRY_WRITE_OFF/TRANSFER (siempre positiva,
    // el signo lo decide el tipo de movimiento en el backend). Para ADJUSTMENT puede
    // ser negativa: una corrección puede subir o bajar el saldo.
    quantity: z.number().refine((v) => v !== 0, 'quantity no puede ser 0'),
    unitCostCents: z.number().int().nonnegative().nullable().optional(),
    stockLocationId: z.string().uuid().optional(),
    fromStockLocationId: z.string().uuid().optional(),
    toStockLocationId: z.string().uuid().optional(),
    reason: z.string().min(1).max(500).optional(), // obligatorio para ADJUSTMENT/LOSS/EXPIRY_WRITE_OFF (R22)
  })
  .refine(
    (v) => (v.type === 'TRANSFER' ? !!v.fromStockLocationId && !!v.toStockLocationId : !!v.stockLocationId),
    { message: 'TRANSFER requiere fromStockLocationId+toStockLocationId; el resto requiere stockLocationId.' },
  );
export type CreateInventoryMovementRequest = z.infer<typeof CreateInventoryMovementRequestSchema>;

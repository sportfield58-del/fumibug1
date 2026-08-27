import { z } from 'zod';
import { EstablishmentTypeSchema } from '../enums';

/**
 * docs/spec/03-modulos.md §C.19 (Configuración) — tipos de servicio, zonas y listas de
 * precios versionadas. docs/spec/08-modelo-datos.md §H.2 `service_types`/`zones`/
 * `price_lists`/`price_list_items`.
 */
export const ServiceTypeSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  key: z.string().min(1).max(60),
  name: z.string().min(1).max(150),
  defaultDurationMinutes: z.number().int().positive().nullable().optional(),
  checklist: z.array(z.unknown()).default([]), // Fase 2: checklist configurable, hoy solo se persiste
  requiredSupplyIds: z.array(z.string().uuid()),
  certificateTemplateKey: z.string().max(60).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ServiceType = z.infer<typeof ServiceTypeSchema>;

export const CreateServiceTypeRequestSchema = z.object({
  key: z.string().min(1).max(60),
  name: z.string().min(1).max(150),
  defaultDurationMinutes: z.number().int().positive().nullable().optional(),
  requiredSupplyIds: z.array(z.string().uuid()).default([]),
  certificateTemplateKey: z.string().max(60).nullable().optional(),
});
export type CreateServiceTypeRequest = z.infer<typeof CreateServiceTypeRequestSchema>;

export const UpdateServiceTypeRequestSchema = CreateServiceTypeRequestSchema.omit({ key: true }).partial();
export type UpdateServiceTypeRequest = z.infer<typeof UpdateServiceTypeRequestSchema>;

/** docs/spec/08-modelo-datos.md §H.2 `zones`. Filtro de zona en el planificador (§C.7). */
export const ZoneSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Zone = z.infer<typeof ZoneSchema>;

export const CreateZoneRequestSchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});
export type CreateZoneRequest = z.infer<typeof CreateZoneRequestSchema>;

export const UpdateZoneRequestSchema = CreateZoneRequestSchema.partial();
export type UpdateZoneRequest = z.infer<typeof UpdateZoneRequestSchema>;

/**
 * docs/spec/03-modulos.md §C.5: "lista de precios versionada por vigencia" — obligatorio
 * en Argentina (los precios cambian cada 2-3 meses). `validTo` nulo = vigente sin fecha
 * de corte. En Postgres, un EXCLUDE USING gist evita solapamiento de rangos de vigencia
 * por tenant (ver comentario en schema.prisma) — acá el contrato no lo valida, es una
 * regla de negocio que se corre en el backend (R en docs/spec/09-reglas.md).
 */
export const PriceListSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  validFrom: z.string().date(),
  validTo: z.string().date().nullable().optional(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PriceList = z.infer<typeof PriceListSchema>;

/** Precio en centavos — CLAUDE.md §4: dinero siempre BIGINT/centavos, nunca FLOAT. */
export const PriceListItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  priceListId: z.string().uuid(),
  serviceTypeId: z.string().uuid(),
  establishmentType: EstablishmentTypeSchema.nullable().optional(), // null = aplica a todos
  priceCents: z.number().int().nonnegative(),
  pricePerSqmCents: z.number().int().nonnegative().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PriceListItem = z.infer<typeof PriceListItemSchema>;

export const PriceListWithItemsSchema = PriceListSchema.extend({
  items: z.array(PriceListItemSchema),
});
export type PriceListWithItems = z.infer<typeof PriceListWithItemsSchema>;

const PriceListItemInputSchema = z.object({
  id: z.string().uuid().optional(), // presente = edita ese item; ausente = alta
  serviceTypeId: z.string().uuid(),
  establishmentType: EstablishmentTypeSchema.nullable().optional(),
  priceCents: z.number().int().nonnegative(),
  pricePerSqmCents: z.number().int().nonnegative().nullable().optional(),
});

export const CreatePriceListRequestSchema = z.object({
  name: z.string().min(1).max(100),
  validFrom: z.string().date(),
  validTo: z.string().date().nullable().optional(),
  isDefault: z.boolean().default(false),
  items: z.array(PriceListItemInputSchema).default([]),
});
export type CreatePriceListRequest = z.infer<typeof CreatePriceListRequestSchema>;

export const UpdatePriceListRequestSchema = CreatePriceListRequestSchema.partial();
export type UpdatePriceListRequest = z.infer<typeof UpdatePriceListRequestSchema>;

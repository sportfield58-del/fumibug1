import { z } from 'zod';
import {
  CustomerContactRoleSchema,
  CustomerTypeSchema,
  EstablishmentTypeSchema,
  GeocodeStatusSchema,
  PaymentTermsSchema,
  TaxConditionSchema,
} from '../enums';

/**
 * docs/spec/03-modulos.md §C.3, §C.4. `Customer`/`CustomerContact`/`ServiceLocation` —
 * clientes, sus contactos (rol: quien contrata ≠ quien abre la puerta ≠ quien paga) y sus
 * ubicaciones de servicio.
 */
export const CustomerContactSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  customerId: z.string().uuid(),
  name: z.string().min(1).max(150),
  role: CustomerContactRoleSchema,
  phone: z.string().max(40).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  isPrimary: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CustomerContact = z.infer<typeof CustomerContactSchema>;

export const CustomerSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: CustomerTypeSchema,
  legalName: z.string().min(1).max(200),
  tradeName: z.string().max(200).nullable().optional(),
  taxId: z.string().max(20).nullable().optional(),
  taxCondition: TaxConditionSchema.nullable().optional(),
  paymentTerms: PaymentTermsSchema,
  creditLimitCents: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()),
  archivedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const CustomerWithContactsSchema = CustomerSchema.extend({
  contacts: z.array(CustomerContactSchema),
});
export type CustomerWithContacts = z.infer<typeof CustomerWithContactsSchema>;

/** docs/spec/08-modelo-datos.md §H.2 `service_locations`. */
export const ServiceLocationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  customerId: z.string().uuid(),
  label: z.string().max(80).nullable().optional(),
  addressLine: z.string().min(1),
  city: z.string().max(100).nullable().optional(),
  province: z.string().max(100).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  geocodeStatus: GeocodeStatusSchema,
  accessNotes: z.string().nullable().optional(),
  hazardNotes: z.string().nullable().optional(),
  establishmentType: EstablishmentTypeSchema,
  areaSqm: z.number().nullable().optional(),
  serviceWindowStart: z.string().nullable().optional(), // HH:mm:ss, hora sin fecha
  serviceWindowEnd: z.string().nullable().optional(),
  zoneId: z.string().uuid().nullable().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ServiceLocation = z.infer<typeof ServiceLocationSchema>;

// --- Listas ---

export const CustomerListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: CustomerTypeSchema.optional(),
  search: z.string().min(1).max(120).optional(),
  includeArchived: z.coerce.boolean().optional(),
});
export type CustomerListQuery = z.infer<typeof CustomerListQuerySchema>;

// --- Alta / edición de cliente (con contactos embebidos: alta y edición siempre
// reemplazan la lista completa de contactos, no hay endpoint aparte — §J.2 no lo lista) ---

const ContactInputSchema = z.object({
  id: z.string().uuid().optional(), // presente = edita ese contacto; ausente = alta
  name: z.string().min(1).max(150),
  role: CustomerContactRoleSchema,
  phone: z.string().max(40).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  isPrimary: z.boolean().default(false),
});

export const CreateCustomerRequestSchema = z.object({
  type: CustomerTypeSchema,
  legalName: z.string().min(1).max(200),
  tradeName: z.string().max(200).nullable().optional(),
  taxId: z.string().max(20).nullable().optional(),
  taxCondition: TaxConditionSchema.nullable().optional(),
  paymentTerms: PaymentTermsSchema.default('CASH'),
  creditLimitCents: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  contacts: z.array(ContactInputSchema).default([]),
});
export type CreateCustomerRequest = z.infer<typeof CreateCustomerRequestSchema>;

export const UpdateCustomerRequestSchema = CreateCustomerRequestSchema.partial();
export type UpdateCustomerRequest = z.infer<typeof UpdateCustomerRequestSchema>;

/** GET /customers/:id/summary — cuenta corriente + resumen de actividad, docs/spec/10-api.md §J.2. */
export const CustomerSummaryResponseSchema = z.object({
  customer: CustomerWithContactsSchema,
  accountBalanceCents: z.number().int(), // negativo = el cliente debe
  upcomingServicesCount: z.number().int().nonnegative(),
  lastServiceAt: z.string().datetime().nullable().optional(),
});
export type CustomerSummaryResponse = z.infer<typeof CustomerSummaryResponseSchema>;

// --- Ubicaciones ---

export const CreateLocationRequestSchema = z.object({
  label: z.string().max(80).nullable().optional(),
  addressLine: z.string().min(1),
  city: z.string().max(100).nullable().optional(),
  province: z.string().max(100).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  accessNotes: z.string().nullable().optional(),
  hazardNotes: z.string().nullable().optional(),
  establishmentType: EstablishmentTypeSchema.default('OTHER'),
  areaSqm: z.number().nullable().optional(),
  serviceWindowStart: z.string().nullable().optional(),
  serviceWindowEnd: z.string().nullable().optional(),
  zoneId: z.string().uuid().nullable().optional(),
});
export type CreateLocationRequest = z.infer<typeof CreateLocationRequestSchema>;

export const UpdateLocationRequestSchema = CreateLocationRequestSchema.partial();
export type UpdateLocationRequest = z.infer<typeof UpdateLocationRequestSchema>;

/** POST /locations/:id/geocode — dispara geocoding server-side; permite lat/lng manual como corrección. */
export const GeocodeLocationRequestSchema = z.object({
  manualLat: z.number().optional(),
  manualLng: z.number().optional(),
});
export type GeocodeLocationRequest = z.infer<typeof GeocodeLocationRequestSchema>;

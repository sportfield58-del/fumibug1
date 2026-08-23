import { z } from 'zod';

/**
 * Enums del sistema. Reflejan 1:1 los ENUM de Postgres que se definen en
 * packages/db/prisma/schema.prisma (docs/spec/08-modelo-datos.md, "ENUM de Postgres,
 * no VARCHAR libre"). No hay generación automática entre ambos: packages/contracts es
 * la fuente de verdad de la API (ADR 0005) y packages/db la de la base; todo cambio acá
 * se refleja a mano en el schema de Prisma en el mismo PR o el inmediato siguiente.
 *
 * Los enums marcados "(sin lista cerrada en el spec)" no vienen enumerados textualmente
 * en docs/spec/ — son una decisión de esta capa para poder tipar el campo. Se pueden
 * ampliar en un PR de contrato normal (ADR 0005 §Reglas duras) si el negocio lo pide.
 */

// ============================================================================
// Tenant
// ============================================================================

export const TENANT_STATUS = ['ACTIVE', 'SUSPENDED', 'TRIAL'] as const;
export const TenantStatusSchema = z.enum(TENANT_STATUS);
export type TenantStatus = z.infer<typeof TenantStatusSchema>;

/** docs/spec/14-saas.md §Q.2 — tablas de billing son Fase 3, pero el campo existe desde el día 1. */
export const TENANT_PLAN = ['CORE', 'PRO', 'ENTERPRISE'] as const;
export const TenantPlanSchema = z.enum(TENANT_PLAN);
export type TenantPlan = z.infer<typeof TenantPlanSchema>;

// ============================================================================
// Clientes / ubicaciones
// ============================================================================

export const CUSTOMER_TYPE = ['INDIVIDUAL', 'COMPANY'] as const;
export const CustomerTypeSchema = z.enum(CUSTOMER_TYPE);
export type CustomerType = z.infer<typeof CustomerTypeSchema>;

/** (sin lista cerrada en el spec) — condiciones frente al IVA/ARCA habituales en Argentina. */
export const TAX_CONDITION = [
  'RESPONSABLE_INSCRIPTO',
  'MONOTRIBUTO',
  'EXENTO',
  'CONSUMIDOR_FINAL',
  'NO_RESPONSABLE',
] as const;
export const TaxConditionSchema = z.enum(TAX_CONDITION);
export type TaxCondition = z.infer<typeof TaxConditionSchema>;

export const PAYMENT_TERMS = ['CASH', 'ACCOUNT', 'CONTRACT'] as const;
export const PaymentTermsSchema = z.enum(PAYMENT_TERMS);
export type PaymentTerms = z.infer<typeof PaymentTermsSchema>;

export const CUSTOMER_CONTACT_ROLE = ['OWNER', 'ONSITE', 'BILLING'] as const;
export const CustomerContactRoleSchema = z.enum(CUSTOMER_CONTACT_ROLE);
export type CustomerContactRole = z.infer<typeof CustomerContactRoleSchema>;

export const GEOCODE_STATUS = ['PENDING', 'OK', 'MANUAL', 'FAILED'] as const;
export const GeocodeStatusSchema = z.enum(GEOCODE_STATUS);
export type GeocodeStatus = z.infer<typeof GeocodeStatusSchema>;

export const ESTABLISHMENT_TYPE = [
  'HOME',
  'GASTRO',
  'FOOD_INDUSTRY',
  'WAREHOUSE',
  'SCHOOL',
  'OFFICE',
  'OTHER',
] as const;
export const EstablishmentTypeSchema = z.enum(ESTABLISHMENT_TYPE);
export type EstablishmentType = z.infer<typeof EstablishmentTypeSchema>;

// ============================================================================
// Personal técnico
// ============================================================================

export const LICENSE_TYPE = ['SANITARY_BOOK', 'TECHNICAL_DIRECTOR'] as const;
export const LicenseTypeSchema = z.enum(LICENSE_TYPE);
export type LicenseType = z.infer<typeof LicenseTypeSchema>;

// ============================================================================
// Servicios — docs/spec/04-estados.md §D.3
// ============================================================================

export const SERVICE_STATUS = [
  'DRAFT',
  'SCHEDULED',
  'ASSIGNED',
  'DISPATCHED',
  'IN_EXECUTION',
  'PENDING_VALIDATION',
  'COMPLETED',
  'PARTIALLY_COMPLETED',
  'RESCHEDULED',
  'CANCELLED',
] as const;
export const ServiceStatusSchema = z.enum(SERVICE_STATUS);
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

export const SERVICE_ORIGIN = [
  'MANUAL',
  'CONTRACT',
  'WARRANTY',
  'RESCHEDULE',
  'PARTIAL_FOLLOWUP',
] as const;
export const ServiceOriginSchema = z.enum(SERVICE_ORIGIN);
export type ServiceOrigin = z.infer<typeof ServiceOriginSchema>;

export const SERVICE_PRIORITY = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const ServicePrioritySchema = z.enum(SERVICE_PRIORITY);
export type ServicePriority = z.infer<typeof ServicePrioritySchema>;

/** (sin lista cerrada en el spec) — motivos de cancelación, R6: "motivo de lista cerrada". */
export const CANCELLATION_REASON = [
  'CUSTOMER_REQUESTED',
  'WEATHER',
  'DATA_ENTRY_ERROR',
  'DUPLICATE',
  'OUT_OF_ZONE',
  'NON_PAYMENT',
  'OTHER',
] as const;
export const CancellationReasonSchema = z.enum(CANCELLATION_REASON);
export type CancellationReason = z.infer<typeof CancellationReasonSchema>;

// ============================================================================
// Contratos recurrentes
// ============================================================================

export const CONTRACT_BILLING_MODE = ['PER_VISIT', 'MONTHLY_FEE'] as const;
export const ContractBillingModeSchema = z.enum(CONTRACT_BILLING_MODE);
export type ContractBillingMode = z.infer<typeof ContractBillingModeSchema>;

export const CONTRACT_STATUS = ['ACTIVE', 'PAUSED', 'CANCELLED'] as const;
export const ContractStatusSchema = z.enum(CONTRACT_STATUS);
export type ContractStatus = z.infer<typeof ContractStatusSchema>;

// ============================================================================
// Rutas — docs/spec/04-estados.md §D.4, §D.5
// ============================================================================

export const ROUTE_STATUS = [
  'DRAFT',
  'READY',
  'PUBLISHED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export const RouteStatusSchema = z.enum(ROUTE_STATUS);
export type RouteStatus = z.infer<typeof RouteStatusSchema>;

export const ROUTE_STOP_STATUS = [
  'PENDING',
  'EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
  'DONE',
  'NO_SHOW',
  'INACCESSIBLE',
  'SKIPPED',
  'CANCELLED',
] as const;
export const RouteStopStatusSchema = z.enum(ROUTE_STOP_STATUS);
export type RouteStopStatus = z.infer<typeof RouteStopStatusSchema>;

export const GPS_STATUS = ['OK', 'DENIED', 'UNAVAILABLE', 'TIMEOUT'] as const;
export const GpsStatusSchema = z.enum(GPS_STATUS);
export type GpsStatus = z.infer<typeof GpsStatusSchema>;

/** (sin lista cerrada en el spec) — motivo de NO_SHOW / INACCESSIBLE / SKIPPED. */
export const STOP_OUTCOME_REASON = [
  'CUSTOMER_ABSENT',
  'PREMISES_CLOSED',
  'CONSTRUCTION_WORK',
  'LOOSE_ANIMAL',
  'NO_WATER_SUPPLY',
  'WEATHER',
  'RAN_OUT_OF_TIME',
  'POWER_OUTAGE',
  'OTHER',
] as const;
export const StopOutcomeReasonSchema = z.enum(STOP_OUTCOME_REASON);
export type StopOutcomeReason = z.infer<typeof StopOutcomeReasonSchema>;

// ============================================================================
// Ejecución — docs/spec/04-estados.md §D.6
// ============================================================================

export const SERVICE_SESSION_STATUS = ['OPEN', 'CLOSED'] as const;
export const ServiceSessionStatusSchema = z.enum(SERVICE_SESSION_STATUS);
export type ServiceSessionStatus = z.infer<typeof ServiceSessionStatusSchema>;

export const EVIDENCE_TYPE = ['PHOTO', 'SIGNATURE', 'DOCUMENT'] as const;
export const EvidenceTypeSchema = z.enum(EVIDENCE_TYPE);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const EVIDENCE_CATEGORY = [
  'BEFORE',
  'DURING',
  'AFTER',
  'FACADE',
  'RECEIPT',
  'ISSUE',
] as const;
export const EvidenceCategorySchema = z.enum(EVIDENCE_CATEGORY);
export type EvidenceCategory = z.infer<typeof EvidenceCategorySchema>;

/** (sin lista cerrada en el spec) */
export const NO_SIGNATURE_REASON = [
  'CUSTOMER_UNAVAILABLE',
  'CUSTOMER_REFUSED',
  'MINOR_ON_SITE',
  'OTHER',
] as const;
export const NoSignatureReasonSchema = z.enum(NO_SIGNATURE_REASON);
export type NoSignatureReason = z.infer<typeof NoSignatureReasonSchema>;

// ============================================================================
// Insumos e inventario — docs/spec/13-inventario-caja.md §N
// ============================================================================

export const SUPPLY_CATEGORY = [
  'INSECTICIDE',
  'RODENTICIDE',
  'DISINFECTANT',
  'BAIT',
  'TRAP',
  'PPE',
  'OTHER',
] as const;
export const SupplyCategorySchema = z.enum(SUPPLY_CATEGORY);
export type SupplyCategory = z.infer<typeof SupplyCategorySchema>;

export const REGISTRY_AUTHORITY = ['ANMAT', 'SENASA', 'OTHER'] as const;
export const RegistryAuthoritySchema = z.enum(REGISTRY_AUTHORITY);
export type RegistryAuthority = z.infer<typeof RegistryAuthoritySchema>;

export const MEASUREMENT_UNIT = ['L', 'ML', 'KG', 'G', 'UNIT'] as const;
export const MeasurementUnitSchema = z.enum(MEASUREMENT_UNIT);
export type MeasurementUnit = z.infer<typeof MeasurementUnitSchema>;

export const STOCK_LOCATION_TYPE = ['WAREHOUSE', 'VEHICLE'] as const;
export const StockLocationTypeSchema = z.enum(STOCK_LOCATION_TYPE);
export type StockLocationType = z.infer<typeof StockLocationTypeSchema>;

export const INVENTORY_MOVEMENT_TYPE = [
  'PURCHASE',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'CONSUMPTION',
  'RETURN',
  'ADJUSTMENT',
  'LOSS',
  'EXPIRY_WRITE_OFF',
] as const;
export const InventoryMovementTypeSchema = z.enum(INVENTORY_MOVEMENT_TYPE);
export type InventoryMovementType = z.infer<typeof InventoryMovementTypeSchema>;

export const APPLICATION_METHOD = [
  'SPRAY',
  'GEL',
  'BAIT_STATION',
  'FOG',
  'DUST',
  'GRANULE',
] as const;
export const ApplicationMethodSchema = z.enum(APPLICATION_METHOD);
export type ApplicationMethod = z.infer<typeof ApplicationMethodSchema>;

// ============================================================================
// Dinero — docs/spec/13-inventario-caja.md §O
// ============================================================================

export const PAYMENT_METHOD = [
  'CASH',
  'TRANSFER',
  'MERCADOPAGO',
  'CARD',
  'CHECK',
  'ACCOUNT',
] as const;
export const PaymentMethodSchema = z.enum(PAYMENT_METHOD);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PAYMENT_STATUS = ['CONFIRMED', 'VOIDED'] as const;
export const PaymentStatusSchema = z.enum(PAYMENT_STATUS);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/** (sin lista cerrada en el spec) — motivo de diferencia de cobro. */
export const PAYMENT_VARIANCE_REASON = [
  'CHANGE_SHORTFALL',
  'UNRECORDED_DISCOUNT',
  'COLLECTION_ERROR',
  'OTHER',
] as const;
export const PaymentVarianceReasonSchema = z.enum(PAYMENT_VARIANCE_REASON);
export type PaymentVarianceReason = z.infer<typeof PaymentVarianceReasonSchema>;

export const CASH_ACCOUNT_TYPE = ['TECHNICIAN', 'OFFICE'] as const;
export const CashAccountTypeSchema = z.enum(CASH_ACCOUNT_TYPE);
export type CashAccountType = z.infer<typeof CashAccountTypeSchema>;

export const CASH_MOVEMENT_TYPE = [
  'SERVICE_PAYMENT',
  'EXPENSE',
  'HANDOVER',
  'ADJUSTMENT',
  'OPENING_BALANCE',
  'REVERSAL',
] as const;
export const CashMovementTypeSchema = z.enum(CASH_MOVEMENT_TYPE);
export type CashMovementType = z.infer<typeof CashMovementTypeSchema>;

export const CASH_CLOSURE_STATUS = ['OPEN', 'DECLARED', 'RECONCILED', 'DISPUTED'] as const;
export const CashClosureStatusSchema = z.enum(CASH_CLOSURE_STATUS);
export type CashClosureStatus = z.infer<typeof CashClosureStatusSchema>;

// ============================================================================
// Certificados
// ============================================================================

export const CERTIFICATE_STATUS = ['DRAFT', 'ISSUED', 'SIGNED', 'VOIDED'] as const;
export const CertificateStatusSchema = z.enum(CERTIFICATE_STATUS);
export type CertificateStatus = z.infer<typeof CertificateStatusSchema>;

// ============================================================================
// Estaciones de monitoreo (Fase 2 — enum listo desde ahora, sin módulo todavía)
// ============================================================================

export const STATION_CONSUMPTION_LEVEL = ['NONE', 'LOW', 'MEDIUM', 'HIGH'] as const;
export const StationConsumptionLevelSchema = z.enum(STATION_CONSUMPTION_LEVEL);
export type StationConsumptionLevel = z.infer<typeof StationConsumptionLevelSchema>;

/** (sin lista cerrada en el spec) */
export const STATION_CONDITION = ['OK', 'DAMAGED', 'MISSING', 'NEEDS_REPLACEMENT'] as const;
export const StationConditionSchema = z.enum(STATION_CONDITION);
export type StationCondition = z.infer<typeof StationConditionSchema>;

// ============================================================================
// Auditoría
// ============================================================================

export const AUDIT_SEVERITY = ['INFO', 'WARNING', 'CRITICAL'] as const;
export const AuditSeveritySchema = z.enum(AUDIT_SEVERITY);
export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;

// ============================================================================
// Membership
// ============================================================================

export const MEMBERSHIP_STATUS = ['ACTIVE', 'SUSPENDED'] as const;
export const MembershipStatusSchema = z.enum(MEMBERSHIP_STATUS);
export type MembershipStatus = z.infer<typeof MembershipStatusSchema>;

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL');

-- CreateEnum
CREATE TYPE "TenantPlan" AS ENUM ('CORE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "TaxCondition" AS ENUM ('RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO', 'CONSUMIDOR_FINAL', 'NO_RESPONSABLE');

-- CreateEnum
CREATE TYPE "PaymentTerms" AS ENUM ('CASH', 'ACCOUNT', 'CONTRACT');

-- CreateEnum
CREATE TYPE "CustomerContactRole" AS ENUM ('OWNER', 'ONSITE', 'BILLING');

-- CreateEnum
CREATE TYPE "GeocodeStatus" AS ENUM ('PENDING', 'OK', 'MANUAL', 'FAILED');

-- CreateEnum
CREATE TYPE "EstablishmentType" AS ENUM ('HOME', 'GASTRO', 'FOOD_INDUSTRY', 'WAREHOUSE', 'SCHOOL', 'OFFICE', 'OTHER');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('SANITARY_BOOK', 'TECHNICAL_DIRECTOR');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ASSIGNED', 'DISPATCHED', 'IN_EXECUTION', 'PENDING_VALIDATION', 'COMPLETED', 'PARTIALLY_COMPLETED', 'RESCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceOrigin" AS ENUM ('MANUAL', 'CONTRACT', 'WARRANTY', 'RESCHEDULE', 'PARTIAL_FOLLOWUP');

-- CreateEnum
CREATE TYPE "ServicePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CancellationReason" AS ENUM ('CUSTOMER_REQUESTED', 'WEATHER', 'DATA_ENTRY_ERROR', 'DUPLICATE', 'OUT_OF_ZONE', 'NON_PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractBillingMode" AS ENUM ('PER_VISIT', 'MONTHLY_FEE');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RouteStopStatus" AS ENUM ('PENDING', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'DONE', 'NO_SHOW', 'INACCESSIBLE', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GpsStatus" AS ENUM ('OK', 'DENIED', 'UNAVAILABLE', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "StopOutcomeReason" AS ENUM ('CUSTOMER_ABSENT', 'PREMISES_CLOSED', 'CONSTRUCTION_WORK', 'LOOSE_ANIMAL', 'NO_WATER_SUPPLY', 'WEATHER', 'RAN_OUT_OF_TIME', 'POWER_OUTAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('PHOTO', 'SIGNATURE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "EvidenceCategory" AS ENUM ('BEFORE', 'DURING', 'AFTER', 'FACADE', 'RECEIPT', 'ISSUE');

-- CreateEnum
CREATE TYPE "NoSignatureReason" AS ENUM ('CUSTOMER_UNAVAILABLE', 'CUSTOMER_REFUSED', 'MINOR_ON_SITE', 'OTHER');

-- CreateEnum
CREATE TYPE "SupplyCategory" AS ENUM ('INSECTICIDE', 'RODENTICIDE', 'DISINFECTANT', 'BAIT', 'TRAP', 'PPE', 'OTHER');

-- CreateEnum
CREATE TYPE "RegistryAuthority" AS ENUM ('ANMAT', 'SENASA', 'OTHER');

-- CreateEnum
CREATE TYPE "MeasurementUnit" AS ENUM ('L', 'ML', 'KG', 'G', 'UNIT');

-- CreateEnum
CREATE TYPE "StockLocationType" AS ENUM ('WAREHOUSE', 'VEHICLE');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'CONSUMPTION', 'RETURN', 'ADJUSTMENT', 'LOSS', 'EXPIRY_WRITE_OFF');

-- CreateEnum
CREATE TYPE "ApplicationMethod" AS ENUM ('SPRAY', 'GEL', 'BAIT_STATION', 'FOG', 'DUST', 'GRANULE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'MERCADOPAGO', 'CARD', 'CHECK', 'ACCOUNT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CONFIRMED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentVarianceReason" AS ENUM ('CHANGE_SHORTFALL', 'UNRECORDED_DISCOUNT', 'COLLECTION_ERROR', 'OTHER');

-- CreateEnum
CREATE TYPE "CashAccountType" AS ENUM ('TECHNICIAN', 'OFFICE');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('SERVICE_PAYMENT', 'EXPENSE', 'HANDOVER', 'ADJUSTMENT', 'OPENING_BALANCE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "CashClosureStatus" AS ENUM ('OPEN', 'DECLARED', 'RECONCILED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('DRAFT', 'ISSUED', 'SIGNED', 'VOIDED');

-- CreateEnum
CREATE TYPE "StationConsumptionLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "StationCondition" AS ENUM ('OK', 'DAMAGED', 'MISSING', 'NEEDS_REPLACEMENT');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "legal_name" VARCHAR(200),
    "tax_id" VARCHAR(20),
    "health_authorization_number" VARCHAR(60),
    "logo_url" TEXT,
    "address" TEXT,
    "phone" VARCHAR(40),
    "email" VARCHAR(200),
    "timezone" VARCHAR(40) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "plan" "TenantPlan" NOT NULL DEFAULT 'CORE',
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "username" VARCHAR(40),
    "full_name" VARCHAR(150),
    "phone" VARCHAR(40),
    "avatar_url" TEXT,
    "color" CHAR(7),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "key" VARCHAR(60) NOT NULL,
    "resource" VARCHAR(40) NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "tenant_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_key" VARCHAR(60) NOT NULL,
    "scope" VARCHAR(10) NOT NULL DEFAULT 'tenant',

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_key")
);

-- CreateTable
CREATE TABLE "technician_profiles" (
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "license_number" VARCHAR(60),
    "license_type" "LicenseType" NOT NULL,
    "license_expires_at" DATE,
    "signature_url" TEXT,
    "vehicle_id" UUID,
    "stock_location_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "technician_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "type" "CustomerType" NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "trade_name" VARCHAR(200),
    "tax_id" VARCHAR(20),
    "tax_condition" "TaxCondition",
    "payment_terms" "PaymentTerms" NOT NULL DEFAULT 'CASH',
    "credit_limit_cents" BIGINT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "archived_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "role" "CustomerContactRole" NOT NULL,
    "phone" VARCHAR(40),
    "email" VARCHAR(200),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "label" VARCHAR(80),
    "address_line" TEXT NOT NULL,
    "city" VARCHAR(100),
    "province" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "geocode_status" "GeocodeStatus" NOT NULL DEFAULT 'PENDING',
    "access_notes" TEXT,
    "hazard_notes" TEXT,
    "establishment_type" "EstablishmentType" NOT NULL DEFAULT 'OTHER',
    "area_sqm" DECIMAL(10,2),
    "service_window_start" TIME,
    "service_window_end" TIME,
    "zone_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "default_duration_minutes" INTEGER,
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "required_supply_ids" UUID[],
    "certificate_template_key" VARCHAR(60),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "service_type_id" UUID NOT NULL,
    "recurrence" JSONB NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "price_cents" BIGINT NOT NULL,
    "billing_mode" "ContractBillingMode" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "generate_ahead_days" INTEGER NOT NULL DEFAULT 30,
    "last_generated_until" DATE,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_locations" (
    "tenant_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "service_location_id" UUID NOT NULL,

    CONSTRAINT "contract_locations_pkey" PRIMARY KEY ("contract_id","service_location_id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "customer_id" UUID NOT NULL,
    "service_location_id" UUID NOT NULL,
    "service_type_id" UUID NOT NULL,
    "contract_id" UUID,
    "parent_service_id" UUID,
    "origin" "ServiceOrigin" NOT NULL DEFAULT 'MANUAL',
    "status" "ServiceStatus" NOT NULL DEFAULT 'DRAFT',
    "target_pests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scheduled_date" DATE,
    "window_start" TIME,
    "window_end" TIME,
    "estimated_duration_minutes" INTEGER,
    "required_technicians" INTEGER NOT NULL DEFAULT 1,
    "price_cents" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'ARS',
    "price_list_id" UUID,
    "is_warranty_visit" BOOLEAN NOT NULL DEFAULT false,
    "warranty_until" DATE,
    "priority" "ServicePriority" NOT NULL DEFAULT 'NORMAL',
    "notes_internal" TEXT,
    "notes_for_technician" TEXT,
    "cancellation_reason" "CancellationReason",
    "cancelled_billable" BOOLEAN,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "technician_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "route_date" DATE NOT NULL,
    "status" "RouteStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "published_by" UUID,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_stops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "RouteStopStatus" NOT NULL DEFAULT 'PENDING',
    "eta" TIME,
    "travel_minutes" INTEGER,
    "en_route_at" TIMESTAMPTZ(6),
    "arrived_at" TIMESTAMPTZ(6),
    "arrival_lat" DECIMAL(10,7),
    "arrival_lng" DECIMAL(10,7),
    "arrival_accuracy_m" DECIMAL(8,2),
    "gps_status" "GpsStatus",
    "distance_from_location_m" INTEGER,
    "outcome_reason" "StopOutcomeReason",
    "wasted_trip" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "route_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "route_stop_id" UUID NOT NULL,
    "technician_id" UUID NOT NULL,
    "status" "ServiceSessionStatus" NOT NULL DEFAULT 'OPEN',
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "start_lat" DECIMAL(10,7),
    "start_lng" DECIMAL(10,7),
    "start_accuracy_m" DECIMAL(8,2),
    "end_lat" DECIMAL(10,7),
    "end_lng" DECIMAL(10,7),
    "end_accuracy_m" DECIMAL(8,2),
    "paused_intervals" JSONB NOT NULL DEFAULT '[]',
    "closure_checklist" JSONB,
    "client_signature_url" TEXT,
    "signer_name" VARCHAR(150),
    "signer_id_number" VARCHAR(20),
    "no_signature_reason" "NoSignatureReason",
    "technician_notes" TEXT,
    "reopened_count" INTEGER NOT NULL DEFAULT 0,
    "auto_closed" BOOLEAN NOT NULL DEFAULT false,
    "client_event_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "service_session_id" UUID NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "category" "EvidenceCategory" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" VARCHAR(100),
    "size_bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" CHAR(64),
    "taken_at" TIMESTAMPTZ(6),
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "accuracy_m" DECIMAL(8,2),
    "client_event_id" UUID NOT NULL,

    CONSTRAINT "service_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" "SupplyCategory" NOT NULL,
    "active_ingredient" VARCHAR(150),
    "concentration" VARCHAR(60),
    "registry_authority" "RegistryAuthority" NOT NULL,
    "registry_number" VARCHAR(40) NOT NULL,
    "purchase_unit" "MeasurementUnit" NOT NULL,
    "application_unit" "MeasurementUnit" NOT NULL,
    "dilution_rate_ml_per_l" DECIMAL(8,3),
    "dose_per_sqm" DECIMAL(8,3),
    "reentry_hours" INTEGER,
    "msds_url" TEXT,
    "unit_cost_cents" BIGINT,
    "requires_lot_tracking" BOOLEAN NOT NULL DEFAULT true,
    "min_stock" DECIMAL(12,4),
    "archived_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supplies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "type" "StockLocationType" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "technician_id" UUID,
    "vehicle_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_lots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "supply_id" UUID NOT NULL,
    "lot_code" VARCHAR(40) NOT NULL,
    "expires_on" DATE,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unit_cost_cents" BIGINT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supply_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "stock_location_id" UUID NOT NULL,
    "supply_id" UUID NOT NULL,
    "lot_id" UUID,
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "stock_location_id" UUID NOT NULL,
    "supply_id" UUID NOT NULL,
    "lot_id" UUID,
    "quantity_delta" DECIMAL(12,4) NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "reference_type" VARCHAR(40),
    "reference_id" UUID,
    "reason" TEXT,
    "unit_cost_cents" BIGINT,
    "requires_adjustment" BOOLEAN NOT NULL DEFAULT false,
    "performed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversal_of_id" BIGINT,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_supply_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "service_session_id" UUID NOT NULL,
    "supply_id" UUID NOT NULL,
    "lot_id" UUID,
    "quantity_applied" DECIMAL(12,4) NOT NULL,
    "unit" "MeasurementUnit" NOT NULL,
    "is_diluted_mix" BOOLEAN NOT NULL DEFAULT false,
    "concentrate_equivalent" DECIMAL(12,4) NOT NULL,
    "application_method" "ApplicationMethod" NOT NULL,
    "treated_area_sqm" DECIMAL(10,2),
    "inventory_movement_id" BIGINT,
    "client_event_id" UUID NOT NULL,

    CONSTRAINT "service_supply_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "service_id" UUID,
    "customer_id" UUID NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'ARS',
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "paid_at" TIMESTAMPTZ(6) NOT NULL,
    "received_by" UUID NOT NULL,
    "receipt_url" TEXT,
    "variance_reason" "PaymentVarianceReason",
    "reversal_of_id" UUID,
    "void_reason" TEXT,
    "client_event_id" UUID,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "type" "CashAccountType" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'ARS',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cash_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cash_account_id" UUID NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "reference_type" VARCHAR(40),
    "reference_id" UUID,
    "closure_id" UUID,
    "description" TEXT,
    "performed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversal_of_id" BIGINT,
    "payment_id" UUID,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_closures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "cash_account_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6),
    "expected_cents" BIGINT,
    "declared_cents" BIGINT,
    "received_cents" BIGINT,
    "status" "CashClosureStatus" NOT NULL DEFAULT 'OPEN',
    "difference_reason" TEXT,
    "declared_by" UUID,
    "declared_at" TIMESTAMPTZ(6),
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "self_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cash_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "formatted_number" VARCHAR(30) NOT NULL,
    "service_id" UUID NOT NULL,
    "service_session_id" UUID NOT NULL,
    "customer_id" UUID,
    "service_location_id" UUID,
    "technical_director_id" UUID NOT NULL,
    "technician_id" UUID,
    "status" "CertificateStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB NOT NULL,
    "pdf_storage_path" TEXT,
    "verification_token" UUID NOT NULL DEFAULT gen_random_uuid(),
    "issued_at" TIMESTAMPTZ(6),
    "signed_at" TIMESTAMPTZ(6),
    "voided_at" TIMESTAMPTZ(6),
    "void_reason" TEXT,
    "replaces_certificate_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "price_list_id" UUID NOT NULL,
    "service_type_id" UUID NOT NULL,
    "establishment_type" "EstablishmentType",
    "price_cents" BIGINT NOT NULL,
    "price_per_sqm_cents" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "body" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(6),
    "sent_channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_role" VARCHAR(40),
    "action" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "diff" JSONB,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "ip" INET,
    "user_agent" TEXT,
    "request_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_events" (
    "client_event_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" UUID,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" JSONB NOT NULL,

    CONSTRAINT "sync_events_pkey" PRIMARY KEY ("client_event_id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" CHAR(7),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plate" VARCHAR(20),
    "model" VARCHAR(100),
    "assigned_to" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_stations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "service_location_id" UUID NOT NULL,
    "number" VARCHAR(20) NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "map_x" DECIMAL(10,4),
    "map_y" DECIMAL(10,4),
    "installed_at" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "monitoring_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_readings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "service_session_id" UUID,
    "station_id" UUID NOT NULL,
    "consumption_level" "StationConsumptionLevel" NOT NULL,
    "captures" INTEGER,
    "replaced" BOOLEAN NOT NULL DEFAULT false,
    "condition" "StationCondition",
    "notes" TEXT,

    CONSTRAINT "station_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_user_id_idx" ON "memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "roles_tenant_id_idx" ON "roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_key_key" ON "roles"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "role_permissions_tenant_id_idx" ON "role_permissions"("tenant_id");

-- CreateIndex
CREATE INDEX "technician_profiles_tenant_id_license_expires_at_idx" ON "technician_profiles"("tenant_id", "license_expires_at");

-- CreateIndex
CREATE INDEX "customers_tenant_id_archived_at_idx" ON "customers"("tenant_id", "archived_at");

-- CreateIndex
CREATE INDEX "customers_tenant_id_tax_id_idx" ON "customers"("tenant_id", "tax_id");

-- CreateIndex
CREATE INDEX "customer_contacts_tenant_id_customer_id_idx" ON "customer_contacts"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "service_locations_tenant_id_customer_id_idx" ON "service_locations"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "service_locations_tenant_id_zone_id_idx" ON "service_locations"("tenant_id", "zone_id");

-- CreateIndex
CREATE INDEX "service_locations_tenant_id_lat_lng_idx" ON "service_locations"("tenant_id", "lat", "lng");

-- CreateIndex
CREATE INDEX "service_types_tenant_id_idx" ON "service_types"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_types_tenant_id_key_key" ON "service_types"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "service_contracts_tenant_id_customer_id_idx" ON "service_contracts"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "service_contracts_tenant_id_status_idx" ON "service_contracts"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "contract_locations_tenant_id_idx" ON "contract_locations"("tenant_id");

-- CreateIndex
CREATE INDEX "services_tenant_id_status_scheduled_date_idx" ON "services"("tenant_id", "status", "scheduled_date");

-- CreateIndex
CREATE INDEX "services_tenant_id_customer_id_idx" ON "services"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "services_tenant_id_service_location_id_idx" ON "services"("tenant_id", "service_location_id");

-- CreateIndex
CREATE INDEX "services_tenant_id_contract_id_idx" ON "services"("tenant_id", "contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "services_tenant_id_code_key" ON "services"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "services_contract_id_scheduled_date_key" ON "services"("contract_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "routes_tenant_id_route_date_status_idx" ON "routes"("tenant_id", "route_date", "status");

-- CreateIndex
CREATE INDEX "routes_tenant_id_technician_id_route_date_idx" ON "routes"("tenant_id", "technician_id", "route_date");

-- CreateIndex
CREATE INDEX "route_stops_tenant_id_route_id_sequence_idx" ON "route_stops"("tenant_id", "route_id", "sequence");

-- CreateIndex
CREATE INDEX "route_stops_tenant_id_status_idx" ON "route_stops"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "service_sessions_tenant_id_service_id_idx" ON "service_sessions"("tenant_id", "service_id");

-- CreateIndex
CREATE INDEX "service_sessions_tenant_id_technician_id_started_at_idx" ON "service_sessions"("tenant_id", "technician_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_sessions_tenant_id_client_event_id_key" ON "service_sessions"("tenant_id", "client_event_id");

-- CreateIndex
CREATE INDEX "service_evidence_tenant_id_service_session_id_idx" ON "service_evidence"("tenant_id", "service_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_evidence_tenant_id_client_event_id_key" ON "service_evidence"("tenant_id", "client_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplies_tenant_id_sku_key" ON "supplies"("tenant_id", "sku");

-- CreateIndex
CREATE INDEX "supply_lots_tenant_id_expires_on_idx" ON "supply_lots"("tenant_id", "expires_on");

-- CreateIndex
CREATE UNIQUE INDEX "supply_lots_tenant_id_supply_id_lot_code_key" ON "supply_lots"("tenant_id", "supply_id", "lot_code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_location_id_supply_id_lot_id_key" ON "inventory"("stock_location_id", "supply_id", "lot_id");

-- CreateIndex
CREATE INDEX "inventory_movements_tenant_id_supply_id_created_at_idx" ON "inventory_movements"("tenant_id", "supply_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_tenant_id_stock_location_id_created_at_idx" ON "inventory_movements"("tenant_id", "stock_location_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_reference_type_reference_id_idx" ON "inventory_movements"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "service_supply_usage_tenant_id_service_session_id_idx" ON "service_supply_usage"("tenant_id", "service_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_supply_usage_tenant_id_client_event_id_key" ON "service_supply_usage"("tenant_id", "client_event_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_paid_at_idx" ON "payments"("tenant_id", "paid_at");

-- CreateIndex
CREATE INDEX "payments_tenant_id_service_id_idx" ON "payments"("tenant_id", "service_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_received_by_paid_at_idx" ON "payments"("tenant_id", "received_by", "paid_at");

-- CreateIndex
CREATE INDEX "payments_tenant_id_method_paid_at_idx" ON "payments"("tenant_id", "method", "paid_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenant_id_client_event_id_key" ON "payments"("tenant_id", "client_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_accounts_tenant_id_owner_user_id_currency_key" ON "cash_accounts"("tenant_id", "owner_user_id", "currency");

-- CreateIndex
CREATE INDEX "cash_movements_tenant_id_cash_account_id_created_at_idx" ON "cash_movements"("tenant_id", "cash_account_id", "created_at");

-- CreateIndex
CREATE INDEX "cash_movements_closure_id_idx" ON "cash_movements"("closure_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_tenant_id_number_key" ON "certificates"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "price_list_items_tenant_id_price_list_id_idx" ON "price_list_items"("tenant_id", "price_list_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_user_id_read_at_idx" ON "notifications"("tenant_id", "user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_tenant_id_user_id_idx" ON "push_subscriptions"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_actor_user_id_created_at_idx" ON "audit_logs"("tenant_id", "actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "sync_events_tenant_id_received_at_idx" ON "sync_events"("tenant_id", "received_at");

-- CreateIndex
CREATE INDEX "zones_tenant_id_idx" ON "zones"("tenant_id");

-- CreateIndex
CREATE INDEX "vehicles_tenant_id_idx" ON "vehicles"("tenant_id");

-- CreateIndex
CREATE INDEX "monitoring_stations_tenant_id_service_location_id_idx" ON "monitoring_stations"("tenant_id", "service_location_id");

-- CreateIndex
CREATE INDEX "station_readings_tenant_id_station_id_idx" ON "station_readings"("tenant_id", "station_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "permissions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_profiles" ADD CONSTRAINT "technician_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_profiles" ADD CONSTRAINT "technician_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_profiles" ADD CONSTRAINT "technician_profiles_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_profiles" ADD CONSTRAINT "technician_profiles_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_types" ADD CONSTRAINT "service_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_locations" ADD CONSTRAINT "contract_locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_locations" ADD CONSTRAINT "contract_locations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "service_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_locations" ADD CONSTRAINT "contract_locations_service_location_id_fkey" FOREIGN KEY ("service_location_id") REFERENCES "service_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_service_location_id_fkey" FOREIGN KEY ("service_location_id") REFERENCES "service_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "service_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_parent_service_id_fkey" FOREIGN KEY ("parent_service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_sessions" ADD CONSTRAINT "service_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_sessions" ADD CONSTRAINT "service_sessions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_sessions" ADD CONSTRAINT "service_sessions_route_stop_id_fkey" FOREIGN KEY ("route_stop_id") REFERENCES "route_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_sessions" ADD CONSTRAINT "service_sessions_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_evidence" ADD CONSTRAINT "service_evidence_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_evidence" ADD CONSTRAINT "service_evidence_service_session_id_fkey" FOREIGN KEY ("service_session_id") REFERENCES "service_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplies" ADD CONSTRAINT "supplies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_lots" ADD CONSTRAINT "supply_lots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_lots" ADD CONSTRAINT "supply_lots_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supplies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supplies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "supply_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supplies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "supply_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "inventory_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_supply_usage" ADD CONSTRAINT "service_supply_usage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_supply_usage" ADD CONSTRAINT "service_supply_usage_service_session_id_fkey" FOREIGN KEY ("service_session_id") REFERENCES "service_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_supply_usage" ADD CONSTRAINT "service_supply_usage_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supplies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_supply_usage" ADD CONSTRAINT "service_supply_usage_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "supply_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_accounts" ADD CONSTRAINT "cash_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_accounts" ADD CONSTRAINT "cash_accounts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_closure_id_fkey" FOREIGN KEY ("closure_id") REFERENCES "cash_closures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "cash_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_service_session_id_fkey" FOREIGN KEY ("service_session_id") REFERENCES "service_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_service_location_id_fkey" FOREIGN KEY ("service_location_id") REFERENCES "service_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_technical_director_id_fkey" FOREIGN KEY ("technical_director_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_replaces_certificate_id_fkey" FOREIGN KEY ("replaces_certificate_id") REFERENCES "certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_stations" ADD CONSTRAINT "monitoring_stations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_stations" ADD CONSTRAINT "monitoring_stations_service_location_id_fkey" FOREIGN KEY ("service_location_id") REFERENCES "service_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_readings" ADD CONSTRAINT "station_readings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_readings" ADD CONSTRAINT "station_readings_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "monitoring_stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


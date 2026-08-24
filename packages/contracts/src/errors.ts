import { z } from 'zod';

/**
 * Catálogo de ErrorCode — docs/spec/10-api.md §J.1: "Los error.code son un enum estable y
 * documentado. El frontend nunca parsea message." Se usa tanto para el `code` de nivel
 * superior de una respuesta de error como para el `code` de cada item en `error.details[]`
 * (ej. los guards de publicación de ruta, docs/spec/10-api.md §J.3).
 *
 * Agrupado por dominio para que sea manejable. Ampliar esta lista es un cambio de contrato
 * normal (ADR 0005): PR aislado + changelog. No hace falta romper nada para agregar un code.
 */
export const ERROR_CODE = [
  // --- Genéricos / transversales ---
  'VALIDATION_ERROR', // 400
  'UNAUTHENTICATED', // 401 — sin token
  'TOKEN_EXPIRED', // 401
  'FORBIDDEN', // 403 — sin permiso
  'NOT_FOUND', // 404 — incluye "no es de tu tenant", ver R40
  'VERSION_CONFLICT', // 409 — If-Match no coincide
  'STATE_CONFLICT', // 409 — transición de estado inválida (StateMachineService)
  'BUSINESS_RULE_VIOLATION', // 422 — genérico, usar uno específico cuando exista
  'RATE_LIMITED', // 429
  'INTERNAL_ERROR', // 500 — siempre con requestId

  // --- Auth ---
  'INVALID_CREDENTIALS',
  'ACCOUNT_LOCKED', // bloqueo por intentos fallidos, docs/spec/11-seguridad.md §K.1
  'PIN_POLICY_VIOLATION',
  'REFRESH_TOKEN_REUSED', // detección de reuso → revocación forzada
  'TENANT_SUSPENDED',

  // --- Idempotencia / offline (ADR 0006) ---
  'IDEMPOTENT_REPLAY', // no es un error real: se documenta para tipar la respuesta 200 con X-Idempotent-Replay
  'CAUSAL_ORDER_VIOLATION', // R46 — evento fuera de orden en /field/sync

  // --- Servicios ---
  'SERVICE_MISSING_REQUIRED_FIELDS', // R1
  'SERVICE_NOT_ASSIGNED_TO_TECHNICIAN', // R2
  'SERVICE_CLOSURE_CHECKLIST_INCOMPLETE', // R4
  'SERVICE_ALREADY_COMPLETED', // R5 — inmutable fuera de ventana de reapertura
  'SERVICE_REOPEN_WINDOW_EXPIRED', // R5 — más de 7 días
  'SERVICE_CANCELLATION_REASON_REQUIRED', // R6

  // --- Rutas ---
  'ROUTE_VALIDATION_FAILED', // 422 — contenedor de guards, docs/spec/10-api.md §J.3
  'ROUTE_HAS_STARTED_STOPS', // no se puede despublicar/quitar stop
  'TECHNICIAN_LICENSE_EXPIRED', // R15 — bloqueo duro
  'TECHNICIAN_ALREADY_HAS_ROUTE_THIS_DATE', // R11
  'INSUFFICIENT_STOCK', // guard de publicación
  'STOP_SEQUENCE_CONFLICT', // UNIQUE(route_id, sequence) DEFERRABLE

  // --- Ejecución ---
  'TECHNICIAN_ALREADY_HAS_OPEN_SESSION', // R3 — índice único parcial
  'NO_SHOW_EVIDENCE_REQUIRED', // R9
  'SESSION_ALREADY_CLOSED',

  // --- Inventario ---
  'LOT_EXPIRED', // R20
  'INVENTORY_WOULD_GO_NEGATIVE', // R19 — bloquea transferencia/ajuste, no consumo de campo
  'INVENTORY_ADJUST_REASON_REQUIRED', // R22

  // --- Dinero ---
  'CASH_CLOSURE_ALREADY_OPEN', // índice único parcial
  'CASH_DIFFERENCE_REQUIRES_APPROVAL', // R28
  'PAYMENT_ALREADY_VOIDED',
  'CASH_PENDING_CLOSURE_BLOCKS_NEW_ROUTE', // R30

  // --- Certificados ---
  'CERTIFICATE_SERVICE_NOT_COMPLETED', // R33
  'CERTIFICATE_SIGNER_LICENSE_INVALID', // R36
  'CERTIFICATE_ALREADY_SIGNED', // R37 — inmutable
  'CERTIFICATE_PRODUCT_DATA_INCOMPLETE', // R38

  // --- Upload de evidencia ---
  'EVIDENCE_FILE_TOO_LARGE',
  'EVIDENCE_MIME_TYPE_NOT_ALLOWED',
  'EVIDENCE_HASH_MISMATCH',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODE);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

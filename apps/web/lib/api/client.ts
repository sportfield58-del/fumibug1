// GENERADO por packages/contracts/scripts/generate.ts a partir de packages/contracts/src/endpoints.ts.
// No editar a mano — correr `pnpm generate` desde la raíz para regenerar.

import type { ApiResponse } from '@fumibug/contracts';
import type { ENDPOINTS as endpoints } from '@fumibug/contracts';

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined;
}

let config: ApiClientConfig = { baseUrl: '/v1' };

/** OpenCode la llama una vez al iniciar la app con la baseUrl real y el getter del token. */
export function configureApiClient(next: Partial<ApiClientConfig>): void {
  config = { ...config, ...next };
}

function toQueryString(
  query: Record<string, string | number | boolean | null | undefined> | undefined,
): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  const token = config.getAccessToken?.();
  const res = await fetch(`${config.baseUrl}/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return (await res.json()) as ApiResponse<T>;
}

/** GET /v1/auth/me — Usuario, tenant, rol y permisos efectivos del token. */
export function getAuthMe(): Promise<ApiResponse<typeof endpoints.authMe.example>> {
  return request('GET', 'auth/me');
}

/** GET /v1/ping — Endpoint dummy de Fase 0 — prueba end-to-end de auth + tenant + permiso + auditoría (sin negocio). */
export function getPing(): Promise<ApiResponse<typeof endpoints.ping.example>> {
  return request('GET', 'ping');
}

/** GET /v1/users — Lista de usuarios del tenant, con su membership y ficha técnica si aplica. */
export function getListUsers(args?: { query?: ReturnType<NonNullable<typeof endpoints.listUsers.query>['parse']> }): Promise<ApiResponse<typeof endpoints.listUsers.example>> {
  return request('GET', 'users' + toQueryString(args?.query));
}

/** POST /v1/users — Alta de usuario (admin/operario/DT), con generación de PIN temporal si es operario. */
export function postCreateUser(args: { body: ReturnType<NonNullable<typeof endpoints.createUser.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createUser.example>> {
  return request('POST', 'users', args.body);
}

/** GET /v1/users/:id — Detalle de un usuario, con membership y ficha técnica. */
export function getGetUser(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.getUser.example>> {
  return request('GET', `users/${args.params.id}`);
}

/** PATCH /v1/users/:id — Edita datos de un usuario (requiere If-Match). No cambia email/username ni rol. */
export function patchUpdateUser(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.updateUser.request>['parse']> }): Promise<ApiResponse<typeof endpoints.updateUser.example>> {
  return request('PATCH', `users/${args.params.id}`, args.body);
}

/** POST /v1/users/:id/reset-pin — Genera un PIN temporal para un operario y fuerza cambio en el próximo login. */
export function postResetUserPin(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.resetUserPin.example>> {
  return request('POST', `users/${args.params.id}/reset-pin`);
}

/** POST /v1/users/:id/force-logout — Revoca todas las sesiones activas de un usuario. */
export function postForceLogoutUser(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.forceLogoutUser.example>> {
  return request('POST', `users/${args.params.id}/force-logout`);
}

/** GET /v1/roles — Los roles del tenant con su matriz de permisos resuelta. */
export function getListRoles(): Promise<ApiResponse<typeof endpoints.listRoles.example>> {
  return request('GET', 'roles');
}

/** GET /v1/customers — Lista de clientes, con sus contactos. */
export function getListCustomers(args?: { query?: ReturnType<NonNullable<typeof endpoints.listCustomers.query>['parse']> }): Promise<ApiResponse<typeof endpoints.listCustomers.example>> {
  return request('GET', 'customers' + toQueryString(args?.query));
}

/** POST /v1/customers — Alta de cliente, con contactos embebidos. */
export function postCreateCustomer(args: { body: ReturnType<NonNullable<typeof endpoints.createCustomer.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createCustomer.example>> {
  return request('POST', 'customers', args.body);
}

/** GET /v1/customers/:id — Detalle de un cliente con sus contactos. */
export function getGetCustomer(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.getCustomer.example>> {
  return request('GET', `customers/${args.params.id}`);
}

/** PATCH /v1/customers/:id — Edita un cliente (requiere If-Match). Reemplaza la lista de contactos si se envía. */
export function patchUpdateCustomer(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.updateCustomer.request>['parse']> }): Promise<ApiResponse<typeof endpoints.updateCustomer.example>> {
  return request('PATCH', `customers/${args.params.id}`, args.body);
}

/** POST /v1/customers/:id/archive — Archiva un cliente (soft delete — CLAUDE.md §5, sin DELETE de negocio). */
export function postArchiveCustomer(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.archiveCustomer.example>> {
  return request('POST', `customers/${args.params.id}/archive`);
}

/** GET /v1/customers/:id/summary — Cuenta corriente + resumen de actividad de un cliente. */
export function getGetCustomerSummary(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.getCustomerSummary.example>> {
  return request('GET', `customers/${args.params.id}/summary`);
}

/** GET /v1/customers/:id/locations — Ubicaciones de un cliente. */
export function getListCustomerLocations(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.listCustomerLocations.example>> {
  return request('GET', `customers/${args.params.id}/locations`);
}

/** POST /v1/customers/:id/locations — Alta de ubicación para un cliente. */
export function postCreateCustomerLocation(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.createCustomerLocation.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createCustomerLocation.example>> {
  return request('POST', `customers/${args.params.id}/locations`, args.body);
}

/** GET /v1/locations/:id — Detalle de una ubicación. */
export function getGetLocation(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.getLocation.example>> {
  return request('GET', `locations/${args.params.id}`);
}

/** PATCH /v1/locations/:id — Edita una ubicación (requiere If-Match). */
export function patchUpdateLocation(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.updateLocation.request>['parse']> }): Promise<ApiResponse<typeof endpoints.updateLocation.example>> {
  return request('PATCH', `locations/${args.params.id}`, args.body);
}

/** POST /v1/locations/:id/geocode — Geocodifica una ubicación (o aplica corrección manual de lat/lng). */
export function postGeocodeLocation(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.geocodeLocation.request>['parse']> }): Promise<ApiResponse<typeof endpoints.geocodeLocation.example>> {
  return request('POST', `locations/${args.params.id}/geocode`, args.body);
}

/** GET /v1/service-types — Catálogo de tipos de servicio del tenant. */
export function getListServiceTypes(): Promise<ApiResponse<typeof endpoints.listServiceTypes.example>> {
  return request('GET', 'service-types');
}

/** POST /v1/service-types — Alta de tipo de servicio. */
export function postCreateServiceType(args: { body: ReturnType<NonNullable<typeof endpoints.createServiceType.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createServiceType.example>> {
  return request('POST', 'service-types', args.body);
}

/** PATCH /v1/service-types/:id — Edita un tipo de servicio (requiere If-Match). No cambia key. */
export function patchUpdateServiceType(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.updateServiceType.request>['parse']> }): Promise<ApiResponse<typeof endpoints.updateServiceType.example>> {
  return request('PATCH', `service-types/${args.params.id}`, args.body);
}

/** GET /v1/zones — Zonas del tenant (filtro del planificador, §C.7). */
export function getListZones(): Promise<ApiResponse<typeof endpoints.listZones.example>> {
  return request('GET', 'zones');
}

/** POST /v1/zones — Alta de zona. */
export function postCreateZone(args: { body: ReturnType<NonNullable<typeof endpoints.createZone.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createZone.example>> {
  return request('POST', 'zones', args.body);
}

/** PATCH /v1/zones/:id — Edita una zona (requiere If-Match). */
export function patchUpdateZone(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.updateZone.request>['parse']> }): Promise<ApiResponse<typeof endpoints.updateZone.example>> {
  return request('PATCH', `zones/${args.params.id}`, args.body);
}

/** GET /v1/price-lists — Listas de precios del tenant, con sus items. */
export function getListPriceLists(): Promise<ApiResponse<typeof endpoints.listPriceLists.example>> {
  return request('GET', 'price-lists');
}

/** POST /v1/price-lists — Alta de lista de precios, con items embebidos. */
export function postCreatePriceList(args: { body: ReturnType<NonNullable<typeof endpoints.createPriceList.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createPriceList.example>> {
  return request('POST', 'price-lists', args.body);
}

/** PATCH /v1/price-lists/:id — Edita una lista de precios (requiere If-Match). Reemplaza items si se envían. */
export function patchUpdatePriceList(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.updatePriceList.request>['parse']> }): Promise<ApiResponse<typeof endpoints.updatePriceList.example>> {
  return request('PATCH', `price-lists/${args.params.id}`, args.body);
}

/** GET /v1/services — Lista filtrada de servicios. */
export function getListServices(args?: { query?: ReturnType<NonNullable<typeof endpoints.listServices.query>['parse']> }): Promise<ApiResponse<typeof endpoints.listServices.example>> {
  return request('GET', 'services' + toQueryString(args?.query));
}

/** POST /v1/services — Alta manual de servicio. */
export function postCreateService(args: { body: ReturnType<NonNullable<typeof endpoints.createService.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createService.example>> {
  return request('POST', 'services', args.body);
}

/** GET /v1/services/:id — Detalle de un servicio. */
export function getGetService(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.getService.example>> {
  return request('GET', `services/${args.params.id}`);
}

/** PATCH /v1/services/:id — Edita un servicio (requiere If-Match). No cambia cliente ni estado. */
export function patchUpdateService(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.updateService.request>['parse']> }): Promise<ApiResponse<typeof endpoints.updateService.example>> {
  return request('PATCH', `services/${args.params.id}`, args.body);
}

/** POST /v1/services/:id/cancel — Cancela un servicio. */
export function postCancelService(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.cancelService.request>['parse']> }): Promise<ApiResponse<typeof endpoints.cancelService.example>> {
  return request('POST', `services/${args.params.id}/cancel`, args.body);
}

/** POST /v1/services/:id/reschedule — Reprograma un servicio a una nueva fecha. */
export function postRescheduleService(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.rescheduleService.request>['parse']> }): Promise<ApiResponse<typeof endpoints.rescheduleService.example>> {
  return request('POST', `services/${args.params.id}/reschedule`, args.body);
}

/** POST /v1/services/:id/validate — Aprueba el cierre de un servicio en PENDING_VALIDATION. */
export function postValidateService(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.validateService.example>> {
  return request('POST', `services/${args.params.id}/validate`);
}

/** POST /v1/services/:id/reject — Rechaza el cierre — vuelve a ejecución. */
export function postRejectService(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.rejectService.request>['parse']> }): Promise<ApiResponse<typeof endpoints.rejectService.example>> {
  return request('POST', `services/${args.params.id}/reject`, args.body);
}

/** POST /v1/services/:id/reopen — Reabre un servicio COMPLETED — anula el certificado si existe. */
export function postReopenService(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.reopenService.request>['parse']> }): Promise<ApiResponse<typeof endpoints.reopenService.example>> {
  return request('POST', `services/${args.params.id}/reopen`, args.body);
}

/** POST /v1/services/:id/warranty-visit — Genera una revisita de garantía (sin cargo) a partir de este servicio. */
export function postWarrantyVisitService(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.warrantyVisitService.example>> {
  return request('POST', `services/${args.params.id}/warranty-visit`);
}

/** GET /v1/routes — Lista de rutas filtradas por fecha/operario/estado. */
export function getListRoutes(args?: { query?: ReturnType<NonNullable<typeof endpoints.listRoutes.query>['parse']> }): Promise<ApiResponse<typeof endpoints.listRoutes.example>> {
  return request('GET', 'routes' + toQueryString(args?.query));
}

/** POST /v1/routes — Crea una ruta vacía para un operario en una fecha. */
export function postCreateRoute(args: { body: ReturnType<NonNullable<typeof endpoints.createRoute.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createRoute.example>> {
  return request('POST', 'routes', args.body);
}

/** GET /v1/routes/:id — Detalle de una ruta con sus stops ordenados. */
export function getGetRoute(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.getRoute.example>> {
  return request('GET', `routes/${args.params.id}`);
}

/** PATCH /v1/routes/:id — Edita una ruta (requiere If-Match). */
export function patchUpdateRoute(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.updateRoute.request>['parse']> }): Promise<ApiResponse<typeof endpoints.updateRoute.example>> {
  return request('PATCH', `routes/${args.params.id}`, args.body);
}

/** POST /v1/routes/:id/stops — Agrega un servicio a la ruta como nuevo stop. */
export function postAddStop(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.addStop.request>['parse']> }): Promise<ApiResponse<typeof endpoints.addStop.example>> {
  return request('POST', `routes/${args.params.id}/stops`, args.body);
}

/** PUT /v1/routes/:id/stops/order — Reordena los stops de la ruta en una transacción (R13). */
export function putReorderStops(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.reorderStops.request>['parse']> }): Promise<ApiResponse<typeof endpoints.reorderStops.example>> {
  return request('PUT', `routes/${args.params.id}/stops/order`, args.body);
}

/** DELETE /v1/routes/:id/stops/:stopId — Quita un stop de la ruta (solo si está PENDING). */
export function deleteRemoveStop(args: { params: { id: string; stopId: string } }): Promise<ApiResponse<typeof endpoints.removeStop.example>> {
  return request('DELETE', `routes/${args.params.id}/stops/${args.params.stopId}`);
}

/** POST /v1/routes/:id/validate — Dry-run de los guards de publicación — no publica, dice qué falta. */
export function postValidateRoute(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.validateRoute.example>> {
  return request('POST', `routes/${args.params.id}/validate`);
}

/** POST /v1/routes/:id/publish — Publica la ruta — transacción atómica: ruta a PUBLISHED, servicios a DISPATCHED, notifica (R12). */
export function postPublishRoute(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.publishRoute.example>> {
  return request('POST', `routes/${args.params.id}/publish`);
}

/** POST /v1/routes/:id/unpublish — Despublica la ruta (solo si ningún stop salió de PENDING — R14). */
export function postUnpublishRoute(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.unpublishRoute.example>> {
  return request('POST', `routes/${args.params.id}/unpublish`);
}

/** POST /v1/routes/:id/reassign — Reasigna la ruta completa a otro operario. */
export function postReassignRoute(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.reassignRoute.request>['parse']> }): Promise<ApiResponse<typeof endpoints.reassignRoute.example>> {
  return request('POST', `routes/${args.params.id}/reassign`, args.body);
}

/** POST /v1/routes/:id/cancel — Cancela la ruta. */
export function postCancelRoute(args: { params: { id: string } }): Promise<ApiResponse<typeof endpoints.cancelRoute.example>> {
  return request('POST', `routes/${args.params.id}/cancel`);
}

/** POST /v1/field/sessions/:id/evidence/upload-url — URL firmada de Storage para subir una evidencia. */
export function postUploadEvidenceUrl(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.uploadEvidenceUrl.request>['parse']> }): Promise<ApiResponse<typeof endpoints.uploadEvidenceUrl.example>> {
  return request('POST', `field/sessions/${args.params.id}/evidence/upload-url`, args.body);
}

/** POST /v1/field/sessions/:id/evidence — Confirma la subida y crea el registro de evidencia. */
export function postConfirmEvidence(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.confirmEvidence.request>['parse']> }): Promise<ApiResponse<typeof endpoints.confirmEvidence.example>> {
  return request('POST', `field/sessions/${args.params.id}/evidence`, args.body);
}

/** GET /v1/reports/dashboard-admin — Dashboard del admin: servicios de hoy, operarios activos, alertas, cobrado hoy. */
export function getGetAdminDashboard(): Promise<ApiResponse<typeof endpoints.getAdminDashboard.example>> {
  return request('GET', 'reports/dashboard-admin');
}

/** GET /v1/reports/dashboard-owner — Dashboard del owner: los 4 números del negocio. */
export function getGetOwnerDashboard(): Promise<ApiResponse<typeof endpoints.getOwnerDashboard.example>> {
  return request('GET', 'reports/dashboard-owner');
}

/** GET /v1/audit-logs — Log de auditoría, paginado por cursor. */
export function getListAuditLogs(args?: { query?: ReturnType<NonNullable<typeof endpoints.listAuditLogs.query>['parse']> }): Promise<ApiResponse<typeof endpoints.listAuditLogs.example>> {
  return request('GET', 'audit-logs' + toQueryString(args?.query));
}

/** GET /v1/supplies — Catálogo de insumos del tenant. */
export function getListSupplies(): Promise<ApiResponse<typeof endpoints.listSupplies.example>> {
  return request('GET', 'supplies');
}

/** POST /v1/supplies — Alta de insumo en el catálogo. */
export function postCreateSupply(args: { body: ReturnType<NonNullable<typeof endpoints.createSupply.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createSupply.example>> {
  return request('POST', 'supplies', args.body);
}

/** PATCH /v1/supplies/:id — Edita un insumo (requiere If-Match). No cambia sku. */
export function patchUpdateSupply(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.updateSupply.request>['parse']> }): Promise<ApiResponse<typeof endpoints.updateSupply.example>> {
  return request('PATCH', `supplies/${args.params.id}`, args.body);
}

/** GET /v1/stock-locations — Ubicaciones de stock del tenant (depósito central + una por operario, §N.2). */
export function getListStockLocations(): Promise<ApiResponse<typeof endpoints.listStockLocations.example>> {
  return request('GET', 'stock-locations');
}

/** GET /v1/inventory — Saldo actual por ubicación/insumo/lote (proyección, §N.2). */
export function getListInventory(args?: { query?: ReturnType<NonNullable<typeof endpoints.listInventory.query>['parse']> }): Promise<ApiResponse<typeof endpoints.listInventory.example>> {
  return request('GET', 'inventory' + toQueryString(args?.query));
}

/** GET /v1/inventory/movements — Historial de movimientos de inventario, paginado (append-only, R42). */
export function getListInventoryMovements(args?: { query?: ReturnType<NonNullable<typeof endpoints.listInventoryMovements.query>['parse']> }): Promise<ApiResponse<typeof endpoints.listInventoryMovements.example>> {
  return request('GET', 'inventory/movements' + toQueryString(args?.query));
}

/** POST /v1/inventory/movements — Movimiento manual de inventario: compra, transferencia, ajuste, pérdida, devolución o baja por vencimiento (R19, R21, R22). */
export function postCreateInventoryMovement(args: { body: ReturnType<NonNullable<typeof endpoints.createInventoryMovement.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createInventoryMovement.example>> {
  return request('POST', 'inventory/movements', args.body);
}

/** GET /v1/payments — Cobros del tenant, paginados. */
export function getListPayments(args?: { query?: ReturnType<NonNullable<typeof endpoints.listPayments.query>['parse']> }): Promise<ApiResponse<typeof endpoints.listPayments.example>> {
  return request('GET', 'payments' + toQueryString(args?.query));
}

/** POST /v1/payments — Registra un cobro. Si method=CASH, genera un cash_movement en la misma transacción (R24). Si es TRANSFER/otro, no toca la caja del operario (R25). */
export function postCreatePayment(args: { body: ReturnType<NonNullable<typeof endpoints.createPayment.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createPayment.example>> {
  return request('POST', 'payments', args.body);
}

/** POST /v1/payments/:id/void — Anula un pago con un asiento inverso — nunca se edita (R26). */
export function postVoidPayment(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.voidPayment.request>['parse']> }): Promise<ApiResponse<typeof endpoints.voidPayment.example>> {
  return request('POST', `payments/${args.params.id}/void`, args.body);
}

/** GET /v1/cash/accounts — Cajas del tenant con saldo calculado (R27) — scope own/tenant según permiso. */
export function getListCashAccounts(): Promise<ApiResponse<typeof endpoints.listCashAccounts.example>> {
  return request('GET', 'cash/accounts');
}

/** GET /v1/cash/accounts/:id/movements — Historial de movimientos de una caja, paginado (append-only, R42). */
export function getListCashMovements(args: { params: { id: string }; query?: ReturnType<NonNullable<typeof endpoints.listCashMovements.query>['parse']> }): Promise<ApiResponse<typeof endpoints.listCashMovements.example>> {
  return request('GET', `cash/accounts/${args.params.id}/movements` + toQueryString(args?.query));
}

/** POST /v1/cash/accounts/:id/movements — Asiento manual (gasto, ajuste, saldo inicial) — requiere cash.adjust salvo saldo inicial. */
export function postCreateCashMovement(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.createCashMovement.request>['parse']> }): Promise<ApiResponse<typeof endpoints.createCashMovement.example>> {
  return request('POST', `cash/accounts/${args.params.id}/movements`, args.body);
}

/** GET /v1/cash/closures — Rendiciones del tenant, paginadas. */
export function getListCashClosures(args?: { query?: ReturnType<NonNullable<typeof endpoints.listCashClosures.query>['parse']> }): Promise<ApiResponse<typeof endpoints.listCashClosures.example>> {
  return request('GET', 'cash/closures' + toQueryString(args?.query));
}

/** POST /v1/cash/accounts/:id/closures — El operario declara la rendición del período abierto (R27, R28). */
export function postDeclareCashClosure(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.declareCashClosure.request>['parse']> }): Promise<ApiResponse<typeof endpoints.declareCashClosure.example>> {
  return request('POST', `cash/accounts/${args.params.id}/closures`, args.body);
}

/** POST /v1/cash/closures/:id/reconcile — El admin cuenta y concilia la rendición — la diferencia se absorbe con un ADJUSTMENT explícito, la caja nunca arrastra descuadre (R28, R29). */
export function postReconcileCashClosure(args: { params: { id: string }; body: ReturnType<NonNullable<typeof endpoints.reconcileCashClosure.request>['parse']> }): Promise<ApiResponse<typeof endpoints.reconcileCashClosure.example>> {
  return request('POST', `cash/closures/${args.params.id}/reconcile`, args.body);
}

import { Injectable } from '@nestjs/common';

/**
 * Resultado de un intento de geocoding de una dirección.
 * `coords` nulo + `status = FAILED` = no se pudo resolver (proveedor devolvió
 * error o no hay proveedor configurado).
 */
export interface GeocodeResult {
  lat: number | null;
  lng: number | null;
  status: 'OK' | 'FAILED';
}

/** Injection token del puerto de geocoding (permite swap en tests y en el provider real de Google). */
export const GEOCODING_PROVIDER = Symbol('GEOCODING_PROVIDER');

/**
 * Puerto de geocoding — ADR 0009. El spec (12-offline-pwa.md §M.2) pide geocodificar
 * al crear la ubicación, persistir y NUNCA reintentar en bucle (costo). La corrección
 * manual (manualLat/manualLng) no pasa por acá.
 *
 * Implementación por defecto: sin credenciales de Google, no hace llamadas de red
 * (evita el bucle de costo de §M.2) y devuelve FAILED. El proveedor real (Google
 * Geocoding) se agrega en un PR aparte con su credencial, sin cambiar esta interfaz.
 */
export interface GeocodingProvider {
  geocode(addressLine: string, city?: string | null): Promise<GeocodeResult>;
}

@Injectable()
export class NoopGeocodingProvider implements GeocodingProvider {
  geocode(): Promise<GeocodeResult> {
    return Promise.resolve({ lat: null, lng: null, status: 'FAILED' });
  }
}

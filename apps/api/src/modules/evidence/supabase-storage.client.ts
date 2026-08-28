import { Inject, Injectable, Logger } from '@nestjs/common';
import { httpApiError } from '../../common/http/api-response';
import { ENV, type Env } from '../../config/env.module';

const BUCKET = 'evidence';

/**
 * Cliente de Supabase Storage — mismo criterio que SupabaseAuthAdminClient (fetch
 * directo con SUPABASE_SERVICE_ROLE_KEY, sin SDK): es el único punto que toca
 * Storage. docs/spec/03-modulos.md §C.11: "compresión client-side, upload directo a
 * Storage con URL firmada".
 */
@Injectable()
export class SupabaseStorageClient {
  private readonly logger = new Logger(SupabaseStorageClient.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  /** URL firmada de subida (POST .../object/upload/sign/...) — el cliente hace un PUT directo ahí con el archivo, sin pasar por la API. */
  async createSignedUploadUrl(storagePath: string, expiresInSec = 300): Promise<{ uploadUrl: string; expiresAt: string }> {
    const cfg = this.requireConfig();
    const res = await fetch(`${cfg.baseUrl}/storage/v1/object/upload/sign/${BUCKET}/${storagePath}`, {
      method: 'POST',
      headers: this.headers(cfg),
      body: JSON.stringify({ expiresIn: expiresInSec }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Supabase Storage upload/sign → ${res.status}: ${text}`);
      throw httpApiError('INTERNAL_ERROR', 'No se pudo generar la URL de subida. Reintentá.', 502);
    }
    const body = (await res.json()) as { url: string };
    return {
      uploadUrl: `${cfg.baseUrl}/storage/v1${body.url}`,
      expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    };
  }

  private requireConfig(): { baseUrl: string; serviceRoleKey: string } {
    if (!this.env.SUPABASE_URL || !this.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw httpApiError('INTERNAL_ERROR', 'Supabase Storage no está configurado (falta SUPABASE_SERVICE_ROLE_KEY).', 500);
    }
    return { baseUrl: this.env.SUPABASE_URL, serviceRoleKey: this.env.SUPABASE_SERVICE_ROLE_KEY };
  }

  private headers(cfg: { serviceRoleKey: string }): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
    };
  }
}

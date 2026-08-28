import { redirect } from 'next/navigation'

/**
 * "Rutas" en el sidebar y "Planificador" son la misma funcionalidad (armar, ver y
 * publicar rutas) — no hay una pantalla separada. En vez de un 404 real, redirige a
 * donde sí vive el contenido.
 */
export default function RutasRedirectPage(): never {
  redirect('/admin/planificador')
}

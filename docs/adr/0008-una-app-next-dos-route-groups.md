# ADR 0008 — Una sola app Next.js con route groups admin y campo

**Estado:** Aceptado · 2026-08-21

## Contexto
El producto tiene dos interfaces muy distintas: un admin desktop y una PWA mobile para
operarios. La opción intuitiva es hacer dos aplicaciones separadas.

## Decisión
Una sola app Next.js con dos route groups: `(admin)` y `(campo)`. El service worker se
scopea a `/campo` y el manifest declara `start_url: /campo`, de modo que el operario
instala "Fumibug Campo" y el admin nunca carga el SW.

## Alternativas consideradas
- **Dos apps separadas:** el operario instalaría una PWA más "limpia" y el caché estaría
  mejor aislado. Pero significa dos deploys, dos design systems, dos sesiones, dos
  pipelines, y el doble de superficie donde los agentes pueden pisarse — que es justo lo
  que hay que minimizar en este proyecto.

## Consecuencias
- Un solo design system y un solo cliente de API.
- Hay que ser disciplinado con los imports dinámicos para que el bundle de `/campo` no
  arrastre código del admin. Por eso el presupuesto de bundle (<200 KB gz) se mide en CI
  y rompe el build.
- Si en el futuro el operario necesita app nativa, se envuelve `/campo` con Capacitor
  reutilizando el mismo código.

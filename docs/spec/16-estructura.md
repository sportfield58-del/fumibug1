<!-- Extraído de docs/MASTER_SPEC.md · secciones §U -->
<!-- No editar acá: los cambios se hacen en MASTER_SPEC.md y se regenera. -->

## U. ESTRUCTURA DEL PROYECTO

Monorepo con **Turborepo + pnpm workspaces**. Justificación: los contratos compartidos son el mecanismo central de coordinación entre agentes (§V), y eso exige un solo repo.

```
fumibug/
├── apps/
│   ├── api/                          ◄── DUEÑO: Claude Code
│   │   ├── src/
│   │   │   ├── modules/              # feature-based, no layer-based
│   │   │   │   ├── auth/             # controller · service · guards · strategies
│   │   │   │   ├── customers/
│   │   │   │   ├── locations/
│   │   │   │   ├── contracts/
│   │   │   │   ├── services/
│   │   │   │   ├── routes/
│   │   │   │   ├── field/            # endpoints de la app operario
│   │   │   │   ├── inventory/
│   │   │   │   ├── payments/
│   │   │   │   ├── cash/
│   │   │   │   ├── certificates/
│   │   │   │   ├── reports/
│   │   │   │   ├── notifications/
│   │   │   │   └── audit/
│   │   │   ├── common/
│   │   │   │   ├── guards/           # jwt · tenant · permission
│   │   │   │   ├── interceptors/     # audit · logging · transform
│   │   │   │   ├── filters/          # exception filter global
│   │   │   │   ├── decorators/       # @CurrentUser @RequirePermission
│   │   │   │   ├── state-machine/    # servicio genérico de transiciones
│   │   │   │   └── tenant/           # AsyncLocalStorage + extensión Prisma
│   │   │   ├── jobs/                 # cron: contratos · sesiones colgadas · reconciliación
│   │   │   └── main.ts
│   │   └── test/                     # e2e · aislamiento cross-tenant · reglas de negocio
│   │
│   └── web/                          ◄── DUEÑO: OpenCode
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/login
│       │   │   ├── (admin)/          # desktop
│       │   │   │   ├── dashboard · clientes · servicios · planificador
│       │   │   │   ├── rutas · hoy · validacion · certificados
│       │   │   │   ├── inventario · caja · reportes · configuracion · auditoria
│       │   │   └── (campo)/          # PWA — service worker scopeado acá
│       │   │       ├── ruta · stop/[id] · ejecucion/[id] · cierre · sync
│       │   ├── components/
│       │   │   ├── ui/               # design system base
│       │   │   ├── admin/
│       │   │   ├── field/
│       │   │   └── shared/
│       │   ├── lib/
│       │   │   ├── api/              ◄── GENERADO desde contracts. No se edita a mano
│       │   │   ├── offline/          # dexie · outbox · sync-engine
│       │   │   ├── auth/
│       │   │   └── utils/
│       │   ├── hooks/
│       │   ├── stores/               # zustand: solo estado de UI
│       │   └── styles/
│       └── public/                   # manifest · íconos · sw
│
├── packages/
│   ├── contracts/                    ◄── DUEÑO: Claude Code · LECTURA para OpenCode
│   │   └── src/{schemas,dto,enums,errors,index}.ts    # Zod = fuente única de verdad
│   ├── db/                           ◄── DUEÑO: Claude Code
│   │   ├── prisma/{schema.prisma,migrations,seed.ts}
│   │   └── src/client.ts
│   ├── ui/                           ◄── DUEÑO: OpenCode
│   │   └── src/{tokens.css,components,tailwind-preset.ts}
│   └── config/                       ◄── DUEÑO: humano (cambios por PR explícito)
│       └── {eslint,tsconfig,prettier}
│
├── docs/
│   ├── MASTER_SPEC.md                # este documento
│   ├── adr/                          # decisiones arquitectónicas
│   ├── api/openapi.json              # generado
│   └── runbooks/
│
├── .github/workflows/                ◄── DUEÑO: Claude Code
├── CLAUDE.md                         # instrucciones para Claude Code
├── AGENTS.md                         # instrucciones para OpenCode
└── turbo.json · pnpm-workspace.yaml
```

**Reglas de dependencia (verificadas por lint):**
- `apps/web` **no** importa de `apps/api` ni de `packages/db`. Nunca. Solo de `packages/contracts` y `packages/ui`.
- `apps/api` no importa de `apps/web`.
- `packages/contracts` no importa de nadie (sin dependencias más allá de Zod).
- Ninguna app importa Prisma directamente salvo `apps/api`.

---


// Contrato único entre Claude Code y OpenCode (ADR 0005). No se importa nada de acá
// de forma parcial en apps/api ni apps/web: siempre a través de "@fumibug/contracts".
export * from './enums';
export * from './errors';
export * from './responses';
export * from './permissions';
export * from './schemas/tenant';
export * from './schemas/technician-profile';
export * from './schemas/customer';
export * from './schemas/service-catalog';
export * from './schemas/user';
export * from './schemas/membership';
export * from './schemas/role';
export * from './schemas/auth';
export * from './endpoints';

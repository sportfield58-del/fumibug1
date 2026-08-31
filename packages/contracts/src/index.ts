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
export * from './schemas/service';
export * from './schemas/route';
export * from './schemas/evidence';
export * from './schemas/audit';
export * from './schemas/dashboard';
export * from './schemas/user';
export * from './schemas/membership';
export * from './schemas/role';
export * from './schemas/auth';
export * from './schemas/inventory';
export * from './schemas/cash';
export * from './schemas/field';
export * from './schemas/certificate';
export * from './schemas/reports';
export * from './endpoints';

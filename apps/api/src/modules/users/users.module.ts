import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SupabaseAuthAdminClient } from './supabase-auth-admin.client';

/**
 * docs/spec/16-estructura.md §U / contracts/schemas/user.ts. Provee el client admin de
 * Supabase Auth como provider propio (se exporta dentro del módulo): ningún otro módulo
 * toca Supabase Admin salvo este.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService, SupabaseAuthAdminClient],
  exports: [UsersService],
})
export class UsersModule {}

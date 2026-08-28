import { Module } from '@nestjs/common';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { SupabaseStorageClient } from './supabase-storage.client';

@Module({
  controllers: [EvidenceController],
  providers: [EvidenceService, SupabaseStorageClient],
})
export class EvidenceModule {}

import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { CashModule } from '../cash/cash.module';
import { FieldController } from './field.controller';
import { FieldService } from './field.service';

@Module({
  imports: [InventoryModule, CashModule],
  controllers: [FieldController],
  providers: [FieldService],
})
export class FieldModule {}

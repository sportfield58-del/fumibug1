import { Global, Module } from '@nestjs/common';
import { StateMachineService } from './state-machine.service';

/** Global — todo módulo de negocio de Fase 1 inyecta StateMachineService sin repetir imports. */
@Global()
@Module({
  providers: [StateMachineService],
  exports: [StateMachineService],
})
export class StateMachineModule {}

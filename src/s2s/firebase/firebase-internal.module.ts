import { Module } from '@nestjs/common';
import { FirebaseInternalController } from './firebase-internal.controller';
import { FirebaseInternalService } from './firebase-internal.service';

@Module({
  controllers: [FirebaseInternalController],
  imports: [],
  providers: [FirebaseInternalService],
  exports: [],
})
export class FirebaseInternalModule {}

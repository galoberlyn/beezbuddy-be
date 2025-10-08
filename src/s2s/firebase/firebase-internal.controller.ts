import { Body, Controller, Put } from '@nestjs/common';
import { FirebaseInternalService } from './firebase-internal.service';
import { FirebaseUpdateAgents } from './types';

@Controller('/s2s/firebase')
export class FirebaseInternalController {
  constructor(
    private readonly firebaseInternalService: FirebaseInternalService,
  ) {}

  @Put('/agents')
  async bulkUpdate(@Body() body: FirebaseUpdateAgents) {
    return this.firebaseInternalService.bulkUpdateByAgentId(
      body.orgId,
      body.agentIds,
      body.payload,
    );
  }
}

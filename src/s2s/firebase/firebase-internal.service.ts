import { Injectable } from '@nestjs/common';
import { firestore } from 'src/firebase/firestore';

@Injectable()
export class FirebaseInternalService {
  constructor() {}

  async updateByAgentId(
    orgId: string,
    agentId: string,
    payload: Record<string, any>,
  ) {
    await firestore
      .collection(orgId)
      .doc(agentId)
      .set({
        ...payload,
      });
  }

  async bulkUpdateByAgentId(
    orgId: string,
    agentIds: string[],
    payload: Record<string, any>,
  ) {
    const batch = firestore.batch();
    for (const agentId of agentIds) {
      const ref = firestore.collection(orgId).doc(agentId);
      batch.set(ref, payload);
    }
    await batch.commit();
  }
}

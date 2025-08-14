import { Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LangchainService {
  constructor() {}

  async textToDocs(
    text: string,
    organizationId: string,
    agentId: string,
  ): Promise<Document[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1024,
      chunkOverlap: 100,
    });
    const chunks = await splitter.createDocuments([text]);
    return chunks.map((doc, idx) => {
      doc.metadata = {
        ...doc.metadata,
        id: uuidv4(),
        chunk: idx,
        organization_id: organizationId,
        source: 'freetext',
        type: 'text',
        agent_id: agentId,
      };
      return doc;
    });
  }
}

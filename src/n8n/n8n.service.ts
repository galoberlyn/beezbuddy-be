import { Injectable, Logger } from '@nestjs/common';
import {
  DocumentIngestionData,
  LinksIngestionData,
  PlainTextIngestionData,
} from './types';

@Injectable()
export class N8nService {
  N8N_PATH = `${process.env.ENVIRONMENT !== 'production' ? 'webhook-test' : 'webhook'}`;
  N8N_SERVER_URL = `${process.env.N8N_SERVER_URL}/${this.N8N_PATH}`;
  logger = new Logger(N8nService.name);

  constructor() {}

  /**
   * @TODO batch job? para di overloaded si n8n
   * @param data
   */
  async ingestDocument(data: DocumentIngestionData) {
    try {
      if (!data.files || !Array.isArray(data.files)) {
        throw new Error(
          'Invalid document ingestion data: missing required fields',
        );
      }

      if (data.files.length === 0) {
        throw new Error('No documents provided for ingestion');
      }

      for (const file of data.files) {
        const formData = new FormData();
        console.log('processing file', file.originalname);
        formData.append(
          'file',
          new File([file.buffer], file.originalname, { type: file.mimetype }),
        );
        console.log('Requesting to ', this.N8N_SERVER_URL + '/upload');
        formData.append('agentId', data.agentId);
        formData.append('organizationId', data.organizationId);
        const response = await fetch(this.N8N_SERVER_URL + '/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.status !== 200) {
          throw new Error('[n8n] failed with status code: ' + response.status);
        }

        /**
         * @TODO create a row in firestore
         * Pass an the id to n8n and if the job is done, update that row
         * Frontend will listen to that row and update the UI that the agent is ready
         */
      }
    } catch (error) {
      this.logger.error('[N8n] Error ingesting document', error);
      throw new Error('Error ingesting document');
    }
  }

  async ingestPlainText(data: PlainTextIngestionData) {
    if (!data.data) {
      throw new Error('No text provided for ingestion');
    }

    const formData = new FormData();
    formData.append('data', data.data);
    formData.append('agentId', data.agentId);
    formData.append('organizationId', data.organizationId);

    console.log('Passing data to ', this.N8N_SERVER_URL + '/plaintext');
    const response = await fetch(this.N8N_SERVER_URL + '/plaintext', {
      method: 'POST',
      body: formData,
    });

    if (response.status !== 200) {
      throw new Error('[n8n] failed with status code: ' + response.status);
    }
  }

  async ingestLinks(data: LinksIngestionData) {
    if (!data.html) {
      throw new Error('No HTML provided for ingestion');
    }

    const formData = new FormData();
    formData.append('html', data.html);
    formData.append('agentId', data.agentId);
    formData.append('organizationId', data.organizationId);

    console.log('Passing data to ', this.N8N_SERVER_URL + '/scrape');
    const response = await fetch(this.N8N_SERVER_URL + '/scrape', {
      method: 'POST',
      body: formData,
    });

    if (response.status !== 200) {
      throw new Error(
        '[n8n] failed ingesting links with status code: ' + response.status,
      );
    }
  }
}

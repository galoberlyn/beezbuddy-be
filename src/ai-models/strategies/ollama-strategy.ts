import { Inject, Injectable, Logger } from '@nestjs/common';
import { Ollama } from '@langchain/ollama';
import { OllamaEmbeddings } from '@langchain/ollama';
import {
  AIModelStrategy,
  AIModelConfig,
} from '../interfaces/ai-model.interface';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { PG_POOL } from 'src/database/pg.constants';
import { Pool } from 'pg';

@Injectable()
export class OllamaStrategy implements AIModelStrategy {
  private config: AIModelConfig;
  private languageModel: Ollama;
  private embeddingsModel: OllamaEmbeddings;
  private vectorStore: PGVectorStore;
  private isInitialized = false;

  private logger = new Logger(OllamaStrategy.name);

  constructor(
    config: AIModelConfig,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {
    this.config = config;
    try {
      this.initializeModels();
    } catch (error) {
      this.logger.error('Error initializing ai model strategies:', error);
    }
  }

  private initializeModels() {
    // Initialize language model
    this.languageModel = new Ollama({
      model: this.config.modelName,
      baseUrl:
        this.config.baseUrl ||
        process.env.OLLAMA_BASE_URL ||
        'http://127.0.0.1:11434',
      temperature: this.config.temperature || 0.7,
    });

    // Initialize embeddings model
    this.embeddingsModel = new OllamaEmbeddings({
      model: this.config.embeddingsModelName,
      baseUrl:
        this.config.baseUrl ||
        process.env.OLLAMA_BASE_URL ||
        'http://127.0.0.1:11434',
    });

    this.vectorStore = new PGVectorStore(this.embeddingsModel, {
      pool: this.pool,
      postgresConnectionOptions: {
        host: process.env.PG_HOST,
        port: Number(process.env.PG_PORT) || 5432,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
      },
      skipInitializationCheck: true,
      tableName: 'embeddings',
      schemaName: 'ai',
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'embedding',
        contentColumnName: 'text',
        metadataColumnName: 'metadata',
      },
    });

    this.logger.log('Vector store initialized successfully');
  }

  getLanguageModel(): Ollama {
    return this.languageModel;
  }

  async getEmbeddingsModel(): Promise<OllamaEmbeddings> {
    if (!this.isInitialized) {
      await this.waitForInitialization();
    }
    return this.embeddingsModel;
  }

  getVectorStore(): PGVectorStore {
    return this.vectorStore;
  }

  private async waitForInitialization(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout

    while (!this.isInitialized && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (!this.isInitialized) {
      throw new Error('Models failed to initialize within timeout period');
    }
  }

  getModelName(): string {
    return this.config.modelName;
  }

  getEmbeddingsModelName(): string {
    return this.config.embeddingsModelName;
  }
}

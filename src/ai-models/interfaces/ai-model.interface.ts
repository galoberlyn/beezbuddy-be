import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { Embeddings } from '@langchain/core/embeddings';
import { PGVectorStore } from '@langchain/community/dist/vectorstores/pgvector';

export interface AIModelStrategy {
  getLanguageModel(): BaseLanguageModel;
  getEmbeddingsModel(): Promise<Embeddings>;
  getModelName(): string;
  getEmbeddingsModelName(): string;
  getVectorStore(): PGVectorStore;
}

export interface AIModelConfig {
  modelName: string;
  embeddingsModelName: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

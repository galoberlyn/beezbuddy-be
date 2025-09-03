import { Injectable } from '@nestjs/common';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { Embeddings } from '@langchain/core/embeddings';
import { StrategyFactory, ModelType } from './strategies/strategy-factory';
import { AIModelConfig } from './interfaces/ai-model.interface';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';

@Injectable()
export class AiModelsService {
  constructor(private readonly strategyFactory: StrategyFactory) {}

  /**
   * Get the current language model
   */
  getLanguageModel(): BaseLanguageModel {
    const strategy = this.strategyFactory.getStrategy();
    return strategy.getLanguageModel();
  }

  /**
   * Get the current embeddings model
   */
  async getEmbeddingsModel(): Promise<Embeddings> {
    const strategy = this.strategyFactory.getStrategy();
    return await strategy.getEmbeddingsModel();
  }

  /**
   * Get the current model name
   */
  getCurrentModelName(): string {
    return this.strategyFactory.getStrategy().getModelName();
  }

  /**
   * Get the current embeddings model name
   */
  getCurrentEmbeddingsModelName(): string {
    return this.strategyFactory.getStrategy().getEmbeddingsModelName();
  }

  /**
   * Get the current strategy type
   */
  getCurrentStrategyType(): ModelType {
    return this.strategyFactory.getCurrentStrategy();
  }

  /**
   * Switch to a different model strategy
   */
  switchStrategy(type: ModelType, config?: AIModelConfig): void {
    this.strategyFactory.setStrategy(type, config);
  }

  /**
   * Get available strategy types
   */
  getAvailableStrategies(): ModelType[] {
    return this.strategyFactory.getAvailableStrategies();
  }

  /**
   * Generate text using the current language model
   */
  generateText(prompt: string): string {
    const model = this.getLanguageModel();
    const response = model.invoke(prompt);
    return (response as unknown as any).content as string;
  }

  /**
   * Generate embeddings for text using the current embeddings model
   */
  async generateEmbeddings(text: string): Promise<number[]> {
    const embeddings = await this.getEmbeddingsModel();
    const result = await embeddings.embedQuery(text);
    return result;
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddingsForDocuments(texts: string[]): Promise<number[][]> {
    const embeddings = await this.getEmbeddingsModel();
    const results = await embeddings.embedDocuments(texts);
    return results;
  }

  /**
   * Get the vector store
   */
  getVectorStore(): PGVectorStore {
    const strategy = this.strategyFactory.getStrategy();
    return strategy.getVectorStore();
  }
}

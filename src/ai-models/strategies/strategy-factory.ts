import { Inject, Injectable } from '@nestjs/common';
import { OllamaStrategy } from './ollama-strategy';
import {
  AIModelStrategy,
  AIModelConfig,
} from '../interfaces/ai-model.interface';
import { PG_POOL } from 'src/database/pg.constants';
import { Pool } from 'pg';

export enum ModelType {
  OLLAMA = 'ollama',
  // Add more model types here as needed
  // OPENAI = 'openai',
  // ANTHROPIC = 'anthropic',
  // GOOGLE = 'google',
}

@Injectable()
export class StrategyFactory {
  private strategies: Map<ModelType, AIModelStrategy> = new Map();
  private currentStrategy: ModelType = ModelType.OLLAMA;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    this.initializeDefaultStrategies();
  }

  private initializeDefaultStrategies(): void {
    // Default Ollama configuration
    const ollamaConfig: AIModelConfig = {
      modelName: 'llama3.2:latest',
      embeddingsModelName: 'nomic-embed-text:v1.5',
      baseUrl: 'http://127.0.0.1:11434',
      temperature: 0.7,
    };

    this.strategies.set(
      ModelType.OLLAMA,
      new OllamaStrategy(ollamaConfig, this.pool),
    );
  }

  getStrategy(type: ModelType = this.currentStrategy): AIModelStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new Error(`Strategy for type ${type} not found`);
    }
    return strategy;
  }

  setStrategy(type: ModelType, config?: AIModelConfig): void {
    switch (type) {
      case ModelType.OLLAMA: {
        const ollamaConfig = config || {
          modelName: 'llama3.2:latest',
          embeddingsModelName: 'nomic-embed-text:v1.5',
          baseUrl: 'http://127.0.0.1:11434',
          temperature: 0.7,
        };
        this.strategies.set(type, new OllamaStrategy(ollamaConfig, this.pool));
        break;
      }
      // Add more cases for other model types
      default:
        throw new Error(`Unsupported model type: ${type as string}`);
    }
    this.currentStrategy = type;
  }

  getCurrentStrategy(): ModelType {
    return this.currentStrategy;
  }

  getAvailableStrategies(): ModelType[] {
    return Array.from(this.strategies.keys());
  }
}

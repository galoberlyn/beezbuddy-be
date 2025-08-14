import { Injectable } from '@nestjs/common';
import { AIModelConfig } from '../interfaces/ai-model.interface';

@Injectable()
export class AiModelsConfig {
  private readonly defaultConfigs: Map<string, AIModelConfig> = new Map();

  constructor() {
    this.initializeDefaultConfigs();
  }

  private initializeDefaultConfigs(): void {
    // Default Ollama configurations for different models
    this.defaultConfigs.set('llama3.2:latest', {
      modelName: 'llama3.2:latest',
      embeddingsModelName: 'nomic-embed-text:v1.5',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
      temperature: 0.7,
    });
  }

  getConfig(modelName: string): AIModelConfig | undefined {
    return this.defaultConfigs.get(modelName);
  }

  getAllConfigs(): Map<string, AIModelConfig> {
    return new Map(this.defaultConfigs);
  }

  addConfig(name: string, config: AIModelConfig): void {
    this.defaultConfigs.set(name, config);
  }

  removeConfig(name: string): boolean {
    return this.defaultConfigs.delete(name);
  }

  getAvailableModels(): string[] {
    return Array.from(this.defaultConfigs.keys());
  }
}

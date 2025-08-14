# AI Models Service - Internal Usage Guide

This service provides a strategy pattern for managing different AI models and embedding models using LangChain and Ollama.

## Quick Start

### 1. Import the module in your feature module

```typescript
import { Module } from '@nestjs/common';
import { AiModelsModule } from '../ai-models/ai-models.module';
import { YourService } from './your.service';

@Module({
  imports: [AiModelsModule],
  providers: [YourService],
})
export class YourModule {}
```

### 2. Inject and use the service

```typescript
import { Injectable } from '@nestjs/common';
import { AiModelsService } from '../ai-models/ai-models.service';
import { ModelType } from '../ai-models/strategies/strategy-factory';
import { AIModelConfig } from '../ai-models/interfaces/ai-model.interface';

@Injectable()
export class YourService {
  constructor(private readonly aiModelsService: AiModelsService) {}

  async generateContent() {
    // Generate text with default model
    const text = await this.aiModelsService.generateText(
      'Write a short story about a robot learning to paint.'
    );

    // Switch to a different model
    const config: AIModelConfig = {
      modelName: 'codellama',
      embeddingsModelName: 'codellama',
      baseUrl: 'http://localhost:11434',
      temperature: 0.3,
    };
    
    this.aiModelsService.switchStrategy(ModelType.OLLAMA, config);
    
    const code = await this.aiModelsService.generateText(
      'Write a Python function to calculate fibonacci numbers.'
    );

    // Generate embeddings
    const embeddings = await this.aiModelsService.generateEmbeddings(
      'This is a sample text for embedding generation.'
    );

    return { text, code, embeddings };
  }
}
```

## Available Methods

### Text Generation
- `generateText(prompt: string): Promise<string>` - Generate text using current model

### Embeddings
- `generateEmbeddings(text: string): Promise<number[]>` - Generate embeddings for single text
- `generateEmbeddingsForDocuments(texts: string[]): Promise<number[][]>` - Generate embeddings for multiple texts

### Model Management
- `getCurrentModelName(): string` - Get current model name
- `getCurrentEmbeddingsModelName(): string` - Get current embeddings model name
- `getCurrentStrategyType(): ModelType` - Get current strategy type
- `switchStrategy(type: ModelType, config?: AIModelConfig): void` - Switch to different model
- `getAvailableStrategies(): ModelType[]` - Get available strategy types

## Pre-configured Models

The service comes with pre-configured models for Ollama:

- `llama2` - Default Llama2 model
- `llama2:7b` - Llama2 7B parameter model
- `llama2:13b` - Llama2 13B parameter model
- `codellama` - Code-optimized Llama model
- `mistral` - Mistral model
- `gemma` - Google's Gemma model

## Configuration

You can customize model configurations:

```typescript
const customConfig: AIModelConfig = {
  modelName: 'llama2:13b',
  embeddingsModelName: 'llama2:13b',
  baseUrl: 'http://localhost:11434',
  temperature: 0.8,
  maxTokens: 2048,
};
```

## Requirements

- Ollama running locally on `http://localhost:11434`
- Models pulled in Ollama (e.g., `ollama pull llama2`) 
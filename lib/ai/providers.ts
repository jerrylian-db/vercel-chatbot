import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';

const provider = createOpenAICompatible({
  name: 'databricks',
  apiKey: process.env.PROVIDER_API_KEY,
  baseURL: 'https://e2-dogfood.staging.cloud.databricks.com/serving-endpoints',
});

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': provider('ep-gpt4o-new'),
        'chat-model-reasoning': wrapLanguageModel({
          model: provider('ep-gpt4o-new'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': provider('ep-gpt4o-new'),
        'artifact-model': provider('ep-gpt4o-new'),
      },
      imageModels: {
        'small-model': provider('ep-gpt4o-new'),
      },
    });

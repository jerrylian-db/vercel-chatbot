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

import { ClientCredentials } from 'simple-oauth2';

const modelId = process.env.OPENAI_SERVING_ENDPOINT || 'ep-gpt4o-new';

// OAuth2 client configuration
const oauth2Client = new ClientCredentials({
  client: {
    id: process.env.DATABRICKS_CLIENT_ID!,
    secret: process.env.DATABRICKS_CLIENT_SECRET!,
  },
  auth: {
    tokenHost: process.env.DATABRICKS_HOST
      ? `https://${process.env.DATABRICKS_HOST.replace(/^https?:\/\//, '')}`
      : 'https://e2-dogfood.staging.cloud.databricks.com',
    tokenPath: '/oidc/v1/token',
  },
});

// Cache for access token
let cachedToken: any = null;

async function getValidAccessToken() {
  // Check if we have a valid cached token
  if (cachedToken && !cachedToken.expired()) {
    return cachedToken.token.access_token;
  }
  
  try {
    // Get new token
    cachedToken = await oauth2Client.getToken({
      scope: 'all-apis',
    });
    
    return cachedToken.token.access_token;
  } catch (error) {
    console.error('OAuth token error:', error);
    throw error;
  }
}

// Custom fetch function that adds OAuth token
async function customFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await getValidAccessToken();
  
  const headers = {
    ...init?.headers,
    'Authorization': `Bearer ${token}`,
  };
  
  return fetch(input, {
    ...init,
    headers,
  });
}

const provider = createOpenAICompatible({
  name: 'databricks',
  baseURL: 'https://e2-dogfood.staging.cloud.databricks.com/serving-endpoints',
  fetch: customFetch,
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
        'chat-model': provider(modelId),
        'chat-model-reasoning': wrapLanguageModel({
          model: provider(modelId),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': provider(modelId),
        'artifact-model': provider(modelId),
      }
    });

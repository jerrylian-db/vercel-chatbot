import type { CoreAssistantMessage, CoreToolMessage, UIMessage } from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Document } from '@/lib/db/schema';
import { ChatSDKError, type ErrorCode } from './errors';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new ChatSDKError(code as ErrorCode, cause);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatSDKError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatSDKError('offline:chat');
    }

    throw error;
  }
}

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type ResponseMessageWithoutId = CoreToolMessage | CoreAssistantMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function getMostRecentUserMessage(messages: Array<UIMessage>) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Array<Document>,
  index: number,
) {
  if (!documents) return new Date();
  if (index > documents.length) return new Date();

  return documents[index].createdAt;
}

export function getTrailingMessageId({
  messages,
}: {
  messages: Array<ResponseMessage>;
}): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) return null;

  return trailingMessage.id;
}

export function sanitizeText(text: string) {
  return text.replace('<has_function_call>', '');
}

export function getUserFromHeaders(request: Request): string {
  const forwardedUser = request.headers.get('X-Forwarded-User');
  return forwardedUser || 'anonymous';
}

async function getDatabricksOAuthToken(): Promise<string> {
  const host = process.env.DATABRICKS_HOST;
  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;

  if (!host || !clientId || !clientSecret) {
    throw new Error('Missing Databricks OAuth environment variables: DATABRICKS_HOST, DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET');
  }

  const response = await fetch(`https://${host}/oidc/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'all-apis',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get Databricks OAuth token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function createSchemaIfNotExists(pgUser: string, oauthToken: string, pgHost: string, pgPort: string, pgDatabase: string, pgSslMode: string, pgSchema: string): Promise<void> {
  // Only run on server side
  if (typeof window !== 'undefined') {
    return;
  }
  
  const { default: postgres } = await import('postgres');
  
  // Connect without specifying schema to create it
  const tempUrl = `postgresql://${pgUser}:${oauthToken}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=${pgSslMode}`;
  const sql = postgres(tempUrl);
  
  try {
    // Create schema if it doesn't exist and grant permissions
    await sql`CREATE SCHEMA IF NOT EXISTS ${sql(pgSchema)} AUTHORIZATION ${sql(pgUser)}`;
    console.log(`✅ Schema '${pgSchema}' created/verified with authorization for user '${pgUser}'`);
  } catch (error) {
    console.warn(`⚠️  Could not create schema '${pgSchema}':`, error);
    // Continue anyway in case the schema already exists
  } finally {
    await sql.end();
  }
}

export async function preprocessDatabaseEnvironment(): Promise<void> {
  // Only run on server side
  if (typeof window !== 'undefined') {
    return;
  }

  // Set PostgreSQL environment variables
  const pgHost = process.env.PGHOST;
  const pgDatabase = process.env.PGDATABASE;
  const pgPort = process.env.PGPORT || '5432';
  const pgUser = process.env.PGUSER;
  const pgAppName = process.env.PGAPPNAME;
  const pgSslMode = process.env.PGSSLMODE || 'require';

  if (!pgHost || !pgDatabase || !pgUser) {
    throw new Error('Missing PostgreSQL environment variables: PGHOST, PGDATABASE, PGUSER are required');
  }

  try {
    // Get Databricks OAuth token
    const oauthToken = await getDatabricksOAuthToken();

    // Use custom schema instead of public (fallback to 'chatbot' if not specified)
    const pgSchema = process.env.PGSCHEMA || 'chatbot';
    
    // Create schema if it doesn't exist
    await createSchemaIfNotExists(pgUser, oauthToken, pgHost, pgPort, pgDatabase, pgSslMode, pgSchema);
    
    // Generate POSTGRES_URL with OAuth token and schema
    const postgresUrl = `postgresql://${pgUser}:${oauthToken}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=${pgSslMode}${pgAppName ? `&application_name=${pgAppName}` : ''}`;
    
    // Set environment variables
    process.env.POSTGRES_URL = postgresUrl;
    process.env.PGSCHEMA = pgSchema; // Store schema for Drizzle to use
  } catch (error) {
    throw new Error(`Failed to preprocess database environment: ${error instanceof Error ? error.message : 'Unknown error'}. Ensure the Databricks OAuth token has necessary PostgreSQL permissions.`);
  }
}


import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({
  path: '.env.local',
});

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  schemaFilter: [process.env.PGSCHEMA || 'chatbot'],
  dbCredentials: {
    // For migrations, we'll use a basic connection string and let the schema be handled by the migration files
    url: process.env.POSTGRES_URL || `postgresql://${process.env.PGUSER}@${process.env.PGHOST}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE}?sslmode=${process.env.PGSSLMODE || 'require'}`,
  },
});

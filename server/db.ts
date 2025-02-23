import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import { animations } from '@shared/schema';

// Initialize neon client
const sql = neon(process.env.DATABASE_URL!);

// Initialize drizzle with neon client
export const db = drizzle(sql);

// Export tables for convenience
export const tables = {
  animations,
};

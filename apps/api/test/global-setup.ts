import { config } from 'dotenv';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { Client } from 'pg';

// Runs once before the whole e2e suite: makes sure the test database
// exists and carries the current schema. Without this, a fresh checkout
// fails with "database fusionlab_test does not exist" — a setup step, not
// a bug, but one that costs half an hour the first time.
export default async function globalSetup() {
  config({ path: join(__dirname, '..', '.env') });

  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://fusionlab:fusionlab@localhost:5432/fusionlab_test';
  const parsed = new URL(url);
  const databaseName = parsed.pathname.slice(1);

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();

  const existing = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [databaseName],
  );

  if (existing.rowCount === 0) {
    // Identifier interpolation, because CREATE DATABASE takes no
    // parameters. The name comes from our own env var, not from input.
    await client.query(`CREATE DATABASE "${databaseName}"`);
  }

  await client.end();

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

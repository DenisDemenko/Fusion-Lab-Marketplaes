import { config } from 'dotenv';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

// Loaded before every e2e file (jest `setupFiles`). Nothing here talks to
// the database — it only decides which database, which storage directory
// and which integrations the process under test will see.
config({ path: join(__dirname, '..', '.env') });

// A separate database, never the development one: the suite truncates
// every table between files, and doing that to the seeded dev catalogue
// would make "npm run dev" mysteriously empty after a test run.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://fusionlab:fusionlab@localhost:5432/fusionlab_test';

// Uploads land in a throwaway directory per run, so a test that writes
// files cannot leak into the next run or into the developer's storage/.
process.env.STORAGE_DIR = mkdtempSync(join(tmpdir(), 'fusionlab-test-'));

// No LiqPay keys: the suite must exercise the demo confirmation path and
// must never be able to reach the real gateway. The signature-verification
// test sets its own keys locally.
delete process.env.LIQPAY_PUBLIC_KEY;
delete process.env.LIQPAY_PRIVATE_KEY;

// No Anthropic key: the assistant falls back to its deterministic
// catalogue answer, so assertions do not depend on a live model.
delete process.env.ANTHROPIC_API_KEY;

process.env.BRIDGE_API_KEY = 'test-bridge-key';
process.env.WEB_ORIGIN = 'http://localhost:3000';

import { Injectable, NotFoundException } from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

// Where uploaded bytes live. Every module talks to this class and never to
// `fs` directly, so the day this moves to S3 the change is one file — see
// docs/adr/0005-local-disk-storage-with-s3-seam.md for why disk is the
// right first driver and what it costs on Railway.
@Injectable()
export class StorageService {
  private readonly root = resolve(
    process.env.STORAGE_DIR ?? join(process.cwd(), 'storage'),
  );

  // Callers pass a human-meaningful prefix ("listings/<id>") and the real
  // filename; the key gets a UUID so two uploads of "model.stl" cannot
  // overwrite each other, and so a guessed key is useless without a
  // database row granting access.
  async save(
    prefix: string,
    filename: string,
    contents: Buffer,
  ): Promise<{ storageKey: string; sizeBytes: number }> {
    const safeName = filename.replace(/[^\w.-]+/g, '_').slice(-80);
    const storageKey = `${prefix}/${randomUUID()}-${safeName}`;
    const target = this.absolutePath(storageKey);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents);

    return { storageKey, sizeBytes: contents.byteLength };
  }

  read(storageKey: string): Readable {
    const target = this.absolutePath(storageKey);

    if (!existsSync(target)) {
      throw new NotFoundException('Файл більше не доступний у сховищі');
    }

    return createReadStream(target);
  }

  async remove(storageKey: string): Promise<void> {
    const target = this.absolutePath(storageKey);
    if (existsSync(target)) {
      await unlink(target);
    }
  }

  // A storage key comes out of the database, but the database is not a
  // trust boundary for the filesystem: one bad row (or a bug that lets a
  // user influence a key) must not be able to read /etc/passwd through
  // "../../..". Resolve, then prove the result is still inside the root.
  private absolutePath(storageKey: string): string {
    const target = resolve(this.root, storageKey);

    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new NotFoundException('Некоректний ключ сховища');
    }

    return target;
  }
}

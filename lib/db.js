import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PRIVACY } from '@/lib/privacy';

/**
 * Database layer with an automatic toggle — no code changes needed:
 *
 *   DATABASE_URL = postgresql://...  -> Prisma + PostgreSQL (Supabase / Neon)
 *   DATABASE_URL empty               -> local SQLite file (better-sqlite3)
 *   Neither works                    -> in-memory list, so the app never crashes
 *
 * Privacy rules enforced here for every driver:
 *   - every scan belongs to an anonymous ownerId; list() and clear() only touch that owner's rows
 *   - scans older than PRIVACY.retentionDays are deleted automatically
 *   - old rows from versions without owners (ownerId = '') are deleted on startup
 */

const globalStore = globalThis;

const POSTGRES_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Scan" (
    "id" TEXT PRIMARY KEY,
    "inputType" TEXT NOT NULL,
    "inputText" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "reasons" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL DEFAULT ''
  )`,
  `ALTER TABLE "Scan" ADD COLUMN IF NOT EXISTS "ownerId" TEXT NOT NULL DEFAULT ''`,
  `CREATE INDEX IF NOT EXISTS "Scan_ownerId_createdAt_idx" ON "Scan" ("ownerId", "createdAt")`,
  `DELETE FROM "Scan" WHERE "ownerId" = ''`,
];

function cutoffDate() {
  return new Date(Date.now() - PRIVACY.retentionDays * 24 * 60 * 60 * 1000);
}

function parseReasons(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Never returns ownerId to callers.
function normalize(row) {
  return {
    id: row.id,
    inputType: row.inputType,
    inputText: row.inputText,
    riskScore: row.riskScore,
    riskLevel: row.riskLevel,
    reasons: parseReasons(row.reasons),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

/* ---------------------------- PostgreSQL ---------------------------- */
async function createPostgresDriver() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = globalStore.__scanPrisma || new PrismaClient();
  globalStore.__scanPrisma = prisma;

  // Creates / upgrades the table on first use, so `npm run db:push` is optional.
  for (const statement of POSTGRES_STATEMENTS) {
    await prisma.$executeRawUnsafe(statement);
  }

  return {
    name: 'postgres',
    async save(record) {
      const row = await prisma.scan.create({
        data: {
          ownerId: record.ownerId,
          inputType: record.inputType,
          inputText: record.inputText,
          riskScore: record.riskScore,
          riskLevel: record.riskLevel,
          reasons: record.reasons,
        },
      });
      return normalize(row);
    },
    async list(ownerId, limit) {
      const rows = await prisma.scan.findMany({
        where: { ownerId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return rows.map(normalize);
    },
    async clear(ownerId) {
      await prisma.scan.deleteMany({ where: { ownerId } });
    },
    async purge() {
      await prisma.scan.deleteMany({ where: { createdAt: { lt: cutoffDate() } } });
    },
  };
}

/* ------------------------------ SQLite ------------------------------ */
async function createSqliteDriver() {
  const Database = (await import('better-sqlite3')).default;
  const file = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.SQLITE_PATH || './data/scans.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS Scan (
      id TEXT PRIMARY KEY,
      inputType TEXT NOT NULL,
      inputText TEXT NOT NULL,
      riskScore INTEGER NOT NULL,
      riskLevel TEXT NOT NULL,
      reasons TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      ownerId TEXT NOT NULL DEFAULT ''
    );
  `);

  // Upgrade databases created by older versions.
  const columns = db.prepare('PRAGMA table_info(Scan)').all();
  if (!columns.some((c) => c.name === 'ownerId')) {
    db.exec("ALTER TABLE Scan ADD COLUMN ownerId TEXT NOT NULL DEFAULT ''");
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_scan_owner_created ON Scan (ownerId, createdAt DESC)');
  db.exec("DELETE FROM Scan WHERE ownerId = ''");

  const insert = db.prepare(
    'INSERT INTO Scan (id, inputType, inputText, riskScore, riskLevel, reasons, createdAt, ownerId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const select = db.prepare('SELECT * FROM Scan WHERE ownerId = ? ORDER BY createdAt DESC LIMIT ?');
  const wipe = db.prepare('DELETE FROM Scan WHERE ownerId = ?');
  const purge = db.prepare('DELETE FROM Scan WHERE createdAt < ?');

  return {
    name: 'sqlite',
    async save(record) {
      const row = {
        id: randomUUID(),
        inputType: record.inputType,
        inputText: record.inputText,
        riskScore: record.riskScore,
        riskLevel: record.riskLevel,
        reasons: JSON.stringify(record.reasons),
        createdAt: new Date().toISOString(),
      };
      insert.run(row.id, row.inputType, row.inputText, row.riskScore, row.riskLevel, row.reasons, row.createdAt, record.ownerId);
      return normalize(row);
    },
    async list(ownerId, limit) {
      return select.all(ownerId, limit).map(normalize);
    },
    async clear(ownerId) {
      wipe.run(ownerId);
    },
    async purge() {
      purge.run(cutoffDate().toISOString());
    },
  };
}

/* ------------------------------ Memory ------------------------------ */
function createMemoryDriver() {
  const rows = (globalStore.__scanMemory = globalStore.__scanMemory || []);
  return {
    name: 'memory',
    async save(record) {
      const row = { ...normalize({ ...record, id: randomUUID(), createdAt: new Date().toISOString() }), ownerId: record.ownerId };
      rows.unshift(row);
      rows.length = Math.min(rows.length, 500);
      return normalize(row);
    },
    async list(ownerId, limit) {
      return rows.filter((r) => r.ownerId === ownerId).slice(0, limit).map(normalize);
    },
    async clear(ownerId) {
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (rows[i].ownerId === ownerId) rows.splice(i, 1);
      }
    },
    async purge() {
      const cutoff = cutoffDate().getTime();
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (new Date(rows[i].createdAt).getTime() < cutoff) rows.splice(i, 1);
      }
    },
  };
}

/* ------------------------- Driver selection ------------------------- */
async function pickDriver() {
  const url = (process.env.DATABASE_URL || '').trim();
  const notes = [];
  let result = null;

  if (/^postgres(ql)?:\/\//i.test(url)) {
    try {
      result = { driver: await createPostgresDriver(), note: '' };
    } catch (err) {
      notes.push(`PostgreSQL unavailable (${String(err.message).split('\n').pop().slice(0, 140)}).`);
    }
  }

  if (!result) {
    try {
      result = { driver: await createSqliteDriver(), note: notes.join(' ') };
    } catch {
      notes.push('SQLite unavailable, history is kept in memory only.');
      result = { driver: createMemoryDriver(), note: notes.join(' ') };
    }
  }

  try {
    await result.driver.purge();
  } catch (err) {
    console.error('[db] purge failed:', err.message);
  }
  globalStore.__scanLastPurge = Date.now();
  return result;
}

async function getDriver() {
  if (!globalStore.__scanDriverPromise) {
    globalStore.__scanDriverPromise = pickDriver();
  }
  const picked = await globalStore.__scanDriverPromise;

  // Delete expired scans at most once an hour.
  if (Date.now() - (globalStore.__scanLastPurge || 0) > 60 * 60 * 1000) {
    globalStore.__scanLastPurge = Date.now();
    picked.driver.purge().catch((err) => console.error('[db] purge failed:', err.message));
  }
  return picked;
}

/* ----------------------------- Public API ----------------------------- */
export async function saveScan(record) {
  if (!record.ownerId) throw new Error('saveScan needs an ownerId.');
  const { driver, note } = await getDriver();
  const saved = await driver.save(record);
  return { scan: saved, driver: driver.name, note };
}

export async function listScans(ownerId, limit = PRIVACY.maxHistory) {
  const { driver, note } = await getDriver();
  if (!ownerId) return { scans: [], driver: driver.name, note };
  const scans = await driver.list(ownerId, limit);
  return { scans, driver: driver.name, note };
}

export async function clearScans(ownerId) {
  const { driver } = await getDriver();
  if (ownerId) await driver.clear(ownerId);
  return { driver: driver.name };
}

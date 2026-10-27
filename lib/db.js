import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Database layer with an automatic toggle — no code changes needed:
 *
 *   DATABASE_URL = postgresql://...  -> Prisma + PostgreSQL (Supabase / Neon)
 *   DATABASE_URL empty               -> local SQLite file (better-sqlite3)
 *   Neither works (e.g. Vercel + no DATABASE_URL) -> in-memory list, so the app never crashes
 *
 * Every driver exposes the same three methods: save(record), list(limit), clear().
 */

const globalStore = globalThis;

const POSTGRES_CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS "Scan" (
  "id" TEXT PRIMARY KEY,
  "inputType" TEXT NOT NULL,
  "inputText" TEXT NOT NULL,
  "riskScore" INTEGER NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "reasons" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

function parseReasons(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

  // Creates the table on first use, so `npm run db:push` is optional.
  await prisma.$executeRawUnsafe(POSTGRES_CREATE_TABLE);

  return {
    name: 'postgres',
    async save(record) {
      const row = await prisma.scan.create({
        data: {
          inputType: record.inputType,
          inputText: record.inputText,
          riskScore: record.riskScore,
          riskLevel: record.riskLevel,
          reasons: record.reasons,
        },
      });
      return normalize(row);
    },
    async list(limit) {
      const rows = await prisma.scan.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
      return rows.map(normalize);
    },
    async clear() {
      await prisma.scan.deleteMany();
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
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scan_created ON Scan (createdAt DESC);
  `);

  const insert = db.prepare(
    'INSERT INTO Scan (id, inputType, inputText, riskScore, riskLevel, reasons, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const select = db.prepare('SELECT * FROM Scan ORDER BY createdAt DESC LIMIT ?');
  const wipe = db.prepare('DELETE FROM Scan');

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
      insert.run(row.id, row.inputType, row.inputText, row.riskScore, row.riskLevel, row.reasons, row.createdAt);
      return normalize(row);
    },
    async list(limit) {
      return select.all(limit).map(normalize);
    },
    async clear() {
      wipe.run();
    },
  };
}

/* ------------------------------ Memory ------------------------------ */
function createMemoryDriver() {
  const rows = (globalStore.__scanMemory = globalStore.__scanMemory || []);
  return {
    name: 'memory',
    async save(record) {
      const row = normalize({ ...record, id: randomUUID(), createdAt: new Date().toISOString() });
      rows.unshift(row);
      rows.length = Math.min(rows.length, 200);
      return row;
    },
    async list(limit) {
      return rows.slice(0, limit);
    },
    async clear() {
      rows.length = 0;
    },
  };
}

/* ------------------------- Driver selection ------------------------- */
async function pickDriver() {
  const url = (process.env.DATABASE_URL || '').trim();
  const notes = [];

  if (/^postgres(ql)?:\/\//i.test(url)) {
    try {
      const driver = await createPostgresDriver();
      return { driver, note: '' };
    } catch (err) {
      notes.push(`PostgreSQL unavailable (${String(err.message).split('\n').pop().slice(0, 140)}).`);
    }
  }

  try {
    const driver = await createSqliteDriver();
    return { driver, note: notes.join(' ') };
  } catch (err) {
    notes.push('SQLite unavailable, history is kept in memory only.');
  }

  return { driver: createMemoryDriver(), note: notes.join(' ') };
}

async function getDriver() {
  if (!globalStore.__scanDriverPromise) {
    globalStore.__scanDriverPromise = pickDriver();
  }
  return globalStore.__scanDriverPromise;
}

/* ----------------------------- Public API ----------------------------- */
export async function saveScan(record) {
  const { driver, note } = await getDriver();
  const saved = await driver.save(record);
  return { scan: saved, driver: driver.name, note };
}

export async function listScans(limit = 20) {
  const { driver, note } = await getDriver();
  const scans = await driver.list(limit);
  return { scans, driver: driver.name, note };
}

export async function clearScans() {
  const { driver } = await getDriver();
  await driver.clear();
  return { driver: driver.name };
}

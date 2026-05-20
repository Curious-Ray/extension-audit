import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { Report } from '@verdikt/engine';

export interface StoredReport {
  id: string;
  contentHash: string | null;
  report: Report;
  createdAt: string;
}

/** SQLite-backed report store. Reports are cached by bundle content hash. */
export class ReportStore {
  private db: Database.Database;

  constructor(path = 'verdikt.sqlite') {
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        content_hash TEXT,
        report_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reports_hash ON reports(content_hash);
    `);
  }

  /** Save a report, returning its assigned id. */
  save(report: Report, contentHash?: string): string {
    const id = randomUUID();
    this.db
      .prepare('INSERT INTO reports (id, content_hash, report_json, created_at) VALUES (?, ?, ?, ?)')
      .run(id, contentHash ?? null, JSON.stringify(report), new Date().toISOString());
    return id;
  }

  get(id: string): StoredReport | null {
    const row = this.db
      .prepare('SELECT id, content_hash, report_json, created_at FROM reports WHERE id = ?')
      .get(id) as { id: string; content_hash: string | null; report_json: string; created_at: string } | undefined;
    if (!row) return null;
    return {
      id: row.id,
      contentHash: row.content_hash,
      report: JSON.parse(row.report_json) as Report,
      createdAt: row.created_at,
    };
  }

  /** Most recent report for a given content hash, if any (cache hit). */
  findByHash(contentHash: string): StoredReport | null {
    const row = this.db
      .prepare(
        'SELECT id, content_hash, report_json, created_at FROM reports WHERE content_hash = ? ORDER BY created_at DESC LIMIT 1',
      )
      .get(contentHash) as
      | { id: string; content_hash: string | null; report_json: string; created_at: string }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      contentHash: row.content_hash,
      report: JSON.parse(row.report_json) as Report,
      createdAt: row.created_at,
    };
  }

  close(): void {
    this.db.close();
  }
}

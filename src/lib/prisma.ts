import { randomUUID } from "node:crypto";
import path from "node:path";

import Database from "better-sqlite3";
import { JobStatus } from "@/lib/db-types";

type UpsertArgs = {
  where: Record<string, unknown>;
  update: Record<string, unknown>;
  create: Record<string, unknown>;
};

type UpdateArgs = {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
};

type PrismaCompat = {
  appConfig: {
    upsert(args: UpsertArgs): Promise<unknown>;
    update(args: UpdateArgs): Promise<unknown>;
  };
  biliCredential: {
    upsert(args: UpsertArgs): Promise<unknown>;
    update(args: UpdateArgs): Promise<unknown>;
  };
  watchHistoryItem: {
    upsert(args: UpsertArgs): Promise<unknown>;
    findMany(args: {
      where?: Record<string, unknown>;
      include?: { contentTags?: boolean };
      orderBy?: { watchedAt?: "asc" | "desc" };
      take?: number;
    }): Promise<unknown[]>;
    update(args: UpdateArgs): Promise<unknown>;
  };
  contentTag: {
    deleteMany(args: { where: { watchHistoryItemId: string } }): Promise<void>;
    createMany(args: { data: Array<Record<string, unknown>> }): Promise<void>;
  };
  dailySnapshot: {
    upsert(args: { where: { date: Date }; update: Record<string, unknown>; create: Record<string, unknown> }): Promise<unknown>;
    update(args: { where: { date: Date }; data: Record<string, unknown> }): Promise<unknown>;
  };
  weeklySnapshot: {
    upsert(args: { where: { weekKey: string }; update: Record<string, unknown>; create: Record<string, unknown> }): Promise<unknown>;
  };
  dailyReport: {
    findFirst(args: { orderBy: { date: "asc" | "desc" } }): Promise<unknown>;
    findMany(args: { orderBy: { date: "asc" | "desc" }; take: number }): Promise<unknown[]>;
    findUnique(args: { where: { date: Date } }): Promise<unknown>;
    upsert(args: { where: { date: Date }; update: Record<string, unknown>; create: Record<string, unknown> }): Promise<unknown>;
  };
  weeklyReport: {
    findFirst(args: { orderBy: { windowStart: "asc" | "desc" } }): Promise<unknown>;
    findMany(args: { orderBy: { windowStart: "asc" | "desc" }; take: number }): Promise<unknown[]>;
    findUnique(args: { where: { weekKey: string } }): Promise<unknown>;
    upsert(args: { where: { weekKey: string }; update: Record<string, unknown>; create: Record<string, unknown> }): Promise<unknown>;
  };
  jobRun: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    findMany(args: { orderBy: { startedAt: "asc" | "desc" }; take: number }): Promise<unknown[]>;
  };
};

function resolveDatabasePath() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) {
    throw new Error("Only sqlite file URLs are supported in coconon MVP.");
  }

  const rawPath = url.slice(5);
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

const globalForDatabase = globalThis as {
  cocoonDb?: Database.Database;
};

function nowIso() {
  return new Date().toISOString();
}

function getColumns(db: Database.Database, tableName: string) {
  try {
    return (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map((column) => column.name);
  } catch {
    return [];
  }
}

function createComparativeTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_snapshots (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      window_start TEXT NOT NULL,
      window_end TEXT NOT NULL,
      total_videos INTEGER NOT NULL,
      total_duration INTEGER NOT NULL,
      avg_duration REAL NOT NULL,
      unique_authors INTEGER NOT NULL,
      unique_topics INTEGER NOT NULL,
      active_hours TEXT NOT NULL,
      topic_distribution TEXT NOT NULL,
      zone_distribution TEXT NOT NULL,
      author_distribution TEXT NOT NULL,
      novelty_ratio REAL,
      metrics TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_reports (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      body TEXT NOT NULL,
      coconon_score INTEGER,
      coconon_level TEXT,
      comparison_label TEXT NOT NULL,
      comparison_target TEXT NOT NULL,
      comparison_breakdown TEXT NOT NULL,
      evidence TEXT NOT NULL,
      metrics TEXT NOT NULL,
      sample_sufficient INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weekly_snapshots (
      id TEXT PRIMARY KEY,
      week_key TEXT NOT NULL UNIQUE,
      window_start TEXT NOT NULL,
      window_end TEXT NOT NULL,
      total_videos INTEGER NOT NULL,
      total_duration INTEGER NOT NULL,
      avg_duration REAL NOT NULL,
      unique_authors INTEGER NOT NULL,
      unique_topics INTEGER NOT NULL,
      active_hours TEXT NOT NULL,
      topic_distribution TEXT NOT NULL,
      zone_distribution TEXT NOT NULL,
      author_distribution TEXT NOT NULL,
      novelty_ratio REAL,
      metrics TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weekly_reports (
      id TEXT PRIMARY KEY,
      week_key TEXT NOT NULL UNIQUE,
      window_start TEXT NOT NULL,
      window_end TEXT NOT NULL,
      summary TEXT NOT NULL,
      body TEXT NOT NULL,
      coconon_score INTEGER,
      coconon_level TEXT,
      comparison_label TEXT NOT NULL,
      comparison_target TEXT NOT NULL,
      comparison_breakdown TEXT NOT NULL,
      evidence TEXT NOT NULL,
      metrics TEXT NOT NULL,
      sample_sufficient INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function migrateComparativeTables(db: Database.Database) {
  const dailySnapshotColumns = getColumns(db, "daily_snapshots");
  if (dailySnapshotColumns.length > 0 && !dailySnapshotColumns.includes("window_start")) {
    db.exec("DROP TABLE IF EXISTS daily_snapshots");
  }

  const dailyReportColumns = getColumns(db, "daily_reports");
  if (dailyReportColumns.length > 0 && !dailyReportColumns.includes("comparison_breakdown")) {
    db.exec("DROP TABLE IF EXISTS daily_reports");
  }

  const weeklySnapshotColumns = getColumns(db, "weekly_snapshots");
  if (weeklySnapshotColumns.length > 0 && !weeklySnapshotColumns.includes("metrics")) {
    db.exec("DROP TABLE IF EXISTS weekly_snapshots");
  }

  const weeklyReportColumns = getColumns(db, "weekly_reports");
  if (weeklyReportColumns.length > 0 && !weeklyReportColumns.includes("comparison_breakdown")) {
    db.exec("DROP TABLE IF EXISTS weekly_reports");
  }

  createComparativeTables(db);
}

function getDatabase() {
  if (!globalForDatabase.cocoonDb) {
    const db = new Database(resolveDatabasePath());
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    db.exec(`
      CREATE TABLE IF NOT EXISTS app_config (
        singleton TEXT PRIMARY KEY,
        admin_password_hash TEXT,
        llm_base_url TEXT,
        llm_api_key_encrypted TEXT,
        llm_model TEXT,
        llm_enabled INTEGER NOT NULL DEFAULT 1,
        sync_hour INTEGER NOT NULL DEFAULT 1,
        sync_minute INTEGER NOT NULL DEFAULT 0,
        timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
        encryption_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bili_credential (
        singleton TEXT PRIMARY KEY,
        cookie_encrypted TEXT,
        cookie_preview TEXT,
        status TEXT NOT NULL DEFAULT 'UNVERIFIED',
        last_validated_at TEXT,
        failure_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS watch_history_items (
        id TEXT PRIMARY KEY,
        history_key TEXT NOT NULL UNIQUE,
        bvid TEXT,
        aid TEXT,
        oid TEXT,
        business TEXT,
        title TEXT NOT NULL,
        author_name TEXT,
        author_mid TEXT,
        tag_name TEXT,
        sub_tag_name TEXT,
        watched_at TEXT NOT NULL,
        duration INTEGER NOT NULL DEFAULT 0,
        progress INTEGER,
        viewing_at TEXT,
        covers TEXT,
        raw_payload TEXT NOT NULL,
        summary TEXT,
        tag_status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS content_tags (
        id TEXT PRIMARY KEY,
        watch_history_item_id TEXT NOT NULL,
        label TEXT NOT NULL,
        source TEXT NOT NULL,
        confidence REAL,
        summary TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (watch_history_item_id) REFERENCES watch_history_items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS job_runs (
        id TEXT PRIMARY KEY,
        job_type TEXT NOT NULL,
        status TEXT NOT NULL,
        trigger TEXT NOT NULL,
        duration_ms INTEGER,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        error_message TEXT,
        details TEXT
      );
    `);

    const appConfigColumns = getColumns(db, "app_config");
    if (!appConfigColumns.includes("llm_enabled")) {
      db.exec("ALTER TABLE app_config ADD COLUMN llm_enabled INTEGER NOT NULL DEFAULT 1");
    }

    migrateComparativeTables(db);
    globalForDatabase.cocoonDb = db;
  }

  return globalForDatabase.cocoonDb;
}

function toCamel(row: unknown) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const mapped = Object.fromEntries(
    Object.entries(row as Record<string, unknown>).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
      value,
    ]),
  );

  for (const [key, value] of Object.entries(mapped)) {
    if (
      (key.endsWith("At") || key === "date" || key === "windowStart" || key === "windowEnd") &&
      typeof value === "string"
    ) {
      mapped[key] = new Date(value);
    }
  }

  return mapped;
}

const db = getDatabase();

function serializeDate(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function serializeBaseReport(data: Record<string, unknown>, timestamp: string) {
  return {
    summary: data.summary,
    body: data.body,
    cocononScore: data.cocononScore ?? null,
    cocononLevel: data.cocononLevel ?? null,
    comparisonLabel: data.comparisonLabel,
    comparisonTarget: data.comparisonTarget,
    comparisonBreakdown: data.comparisonBreakdown,
    evidence: data.evidence,
    metrics: data.metrics,
    sampleSufficient: data.sampleSufficient ?? 0,
    updatedAt: timestamp,
  };
}

export async function purgeContentData() {
  const clear = db.transaction(() => {
    db.prepare("DELETE FROM content_tags").run();
    db.prepare("DELETE FROM watch_history_items").run();
    db.prepare("DELETE FROM daily_snapshots").run();
    db.prepare("DELETE FROM daily_reports").run();
    db.prepare("DELETE FROM weekly_snapshots").run();
    db.prepare("DELETE FROM weekly_reports").run();
    db.prepare("DELETE FROM job_runs").run();
  });

  clear();
}

export const prisma: PrismaCompat = {
  appConfig: {
    upsert({ where, update, create }: { where: { singleton: string }; update: Record<string, unknown>; create: Record<string, unknown> }) {
      const existing = db.prepare("SELECT * FROM app_config WHERE singleton = ?").get(where.singleton);
      const timestamp = nowIso();

      if (existing) {
        const merged = { ...(toCamel(existing) ?? {}), ...update } as Record<string, unknown>;
        db.prepare(
          `UPDATE app_config SET
            admin_password_hash = @adminPasswordHash,
            llm_base_url = @llmBaseUrl,
            llm_api_key_encrypted = @llmApiKeyEncrypted,
            llm_model = @llmModel,
            llm_enabled = @llmEnabled,
            sync_hour = @syncHour,
            sync_minute = @syncMinute,
            timezone = @timezone,
            encryption_version = @encryptionVersion,
            updated_at = @updatedAt
          WHERE singleton = @singleton`,
        ).run({
          singleton: where.singleton,
          adminPasswordHash: merged.adminPasswordHash ?? null,
          llmBaseUrl: merged.llmBaseUrl ?? null,
          llmApiKeyEncrypted: merged.llmApiKeyEncrypted ?? null,
          llmModel: merged.llmModel ?? null,
          llmEnabled: merged.llmEnabled ?? 1,
          syncHour: merged.syncHour ?? 1,
          syncMinute: merged.syncMinute ?? 0,
          timezone: merged.timezone ?? "Asia/Shanghai",
          encryptionVersion: merged.encryptionVersion ?? 1,
          updatedAt: timestamp,
        });
      } else {
        db.prepare(
          `INSERT INTO app_config (
            singleton, admin_password_hash, llm_base_url, llm_api_key_encrypted, llm_model,
            llm_enabled, sync_hour, sync_minute, timezone, encryption_version, created_at, updated_at
          ) VALUES (
            @singleton, @adminPasswordHash, @llmBaseUrl, @llmApiKeyEncrypted, @llmModel,
            @llmEnabled, @syncHour, @syncMinute, @timezone, @encryptionVersion, @createdAt, @updatedAt
          )`,
        ).run({
          singleton: where.singleton,
          adminPasswordHash: create.adminPasswordHash ?? null,
          llmBaseUrl: create.llmBaseUrl ?? null,
          llmApiKeyEncrypted: create.llmApiKeyEncrypted ?? null,
          llmModel: create.llmModel ?? null,
          llmEnabled: create.llmEnabled ?? 1,
          syncHour: create.syncHour ?? 1,
          syncMinute: create.syncMinute ?? 0,
          timezone: create.timezone ?? "Asia/Shanghai",
          encryptionVersion: create.encryptionVersion ?? 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      return Promise.resolve(toCamel(db.prepare("SELECT * FROM app_config WHERE singleton = ?").get(where.singleton)));
    },
    update({ where, data }: { where: { singleton: string }; data: Record<string, unknown> }) {
      return prisma.appConfig.upsert({
        where,
        update: data,
        create: { singleton: where.singleton, ...data },
      });
    },
  },
  biliCredential: {
    upsert({ where, update, create }: { where: { singleton: string }; update: Record<string, unknown>; create: Record<string, unknown> }) {
      const existing = db.prepare("SELECT * FROM bili_credential WHERE singleton = ?").get(where.singleton);
      const timestamp = nowIso();

      if (existing) {
        const merged = { ...(toCamel(existing) ?? {}), ...update } as Record<string, unknown>;
        db.prepare(
          `UPDATE bili_credential SET
            cookie_encrypted = @cookieEncrypted,
            cookie_preview = @cookiePreview,
            status = @status,
            last_validated_at = @lastValidatedAt,
            failure_reason = @failureReason,
            updated_at = @updatedAt
          WHERE singleton = @singleton`,
        ).run({
          singleton: where.singleton,
          cookieEncrypted: merged.cookieEncrypted ?? null,
          cookiePreview: merged.cookiePreview ?? null,
          status: merged.status ?? "UNVERIFIED",
          lastValidatedAt: serializeDate(merged.lastValidatedAt),
          failureReason: merged.failureReason ?? null,
          updatedAt: timestamp,
        });
      } else {
        db.prepare(
          `INSERT INTO bili_credential (
            singleton, cookie_encrypted, cookie_preview, status, last_validated_at,
            failure_reason, created_at, updated_at
          ) VALUES (
            @singleton, @cookieEncrypted, @cookiePreview, @status, @lastValidatedAt,
            @failureReason, @createdAt, @updatedAt
          )`,
        ).run({
          singleton: where.singleton,
          cookieEncrypted: create.cookieEncrypted ?? null,
          cookiePreview: create.cookiePreview ?? null,
          status: create.status ?? "UNVERIFIED",
          lastValidatedAt: null,
          failureReason: create.failureReason ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      return Promise.resolve(toCamel(db.prepare("SELECT * FROM bili_credential WHERE singleton = ?").get(where.singleton)));
    },
    update({ where, data }: { where: { singleton: string }; data: Record<string, unknown> }) {
      return prisma.biliCredential.upsert({
        where,
        update: data,
        create: { singleton: where.singleton, ...data },
      });
    },
  },
  watchHistoryItem: {
    upsert({ where, update, create }: { where: { historyKey: string }; update: Record<string, unknown>; create: Record<string, unknown> }) {
      const existing = db.prepare("SELECT * FROM watch_history_items WHERE history_key = ?").get(where.historyKey);
      const timestamp = nowIso();

      if (existing) {
        const merged = { ...(toCamel(existing) ?? {}), ...update } as Record<string, unknown>;
        db.prepare(
          `UPDATE watch_history_items SET
            bvid = @bvid, aid = @aid, oid = @oid, business = @business, title = @title,
            author_name = @authorName, author_mid = @authorMid, tag_name = @tagName,
            sub_tag_name = @subTagName, watched_at = @watchedAt, duration = @duration,
            progress = @progress, viewing_at = @viewingAt, covers = @covers,
            raw_payload = @rawPayload, summary = @summary, tag_status = @tagStatus,
            updated_at = @updatedAt
          WHERE history_key = @historyKey`,
        ).run({
          historyKey: where.historyKey,
          bvid: merged.bvid ?? null,
          aid: merged.aid ?? null,
          oid: merged.oid ?? null,
          business: merged.business ?? null,
          title: merged.title,
          authorName: merged.authorName ?? null,
          authorMid: merged.authorMid ?? null,
          tagName: merged.tagName ?? null,
          subTagName: merged.subTagName ?? null,
          watchedAt: serializeDate(merged.watchedAt),
          duration: merged.duration ?? 0,
          progress: merged.progress ?? null,
          viewingAt: merged.viewingAt ?? null,
          covers: merged.covers ?? null,
          rawPayload: merged.rawPayload,
          summary: merged.summary ?? null,
          tagStatus: merged.tagStatus ?? "PENDING",
          updatedAt: timestamp,
        });
      } else {
        db.prepare(
          `INSERT INTO watch_history_items (
            id, history_key, bvid, aid, oid, business, title, author_name, author_mid,
            tag_name, sub_tag_name, watched_at, duration, progress, viewing_at, covers,
            raw_payload, summary, tag_status, created_at, updated_at
          ) VALUES (
            @id, @historyKey, @bvid, @aid, @oid, @business, @title, @authorName, @authorMid,
            @tagName, @subTagName, @watchedAt, @duration, @progress, @viewingAt, @covers,
            @rawPayload, @summary, @tagStatus, @createdAt, @updatedAt
          )`,
        ).run({
          id: create.id ?? randomUUID(),
          historyKey: where.historyKey,
          bvid: create.bvid ?? null,
          aid: create.aid ?? null,
          oid: create.oid ?? null,
          business: create.business ?? null,
          title: create.title,
          authorName: create.authorName ?? null,
          authorMid: create.authorMid ?? null,
          tagName: create.tagName ?? null,
          subTagName: create.subTagName ?? null,
          watchedAt: serializeDate(create.watchedAt),
          duration: create.duration ?? 0,
          progress: create.progress ?? null,
          viewingAt: create.viewingAt ?? null,
          covers: create.covers ?? null,
          rawPayload: create.rawPayload,
          summary: create.summary ?? null,
          tagStatus: create.tagStatus ?? "PENDING",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      const row = toCamel(db.prepare("SELECT * FROM watch_history_items WHERE history_key = ?").get(where.historyKey)) as Record<string, unknown> | null;
      return Promise.resolve({ ...row, __created: !existing });
    },
    findMany({ where, include, orderBy, take }: { where?: Record<string, unknown>; include?: { contentTags?: boolean }; orderBy?: { watchedAt?: "asc" | "desc" }; take?: number }) {
      let sql = "SELECT * FROM watch_history_items";
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (where?.tagStatus && typeof where.tagStatus === "object" && "in" in where.tagStatus) {
        const values = (where.tagStatus as { in: string[] }).in;
        conditions.push(`tag_status IN (${values.map(() => "?").join(",")})`);
        params.push(...values);
      }

      if (where?.watchedAt && typeof where.watchedAt === "object") {
        const range = where.watchedAt as { gte?: Date; lte?: Date };
        if (range.gte) {
          conditions.push("watched_at >= ?");
          params.push(range.gte.toISOString());
        }
        if (range.lte) {
          conditions.push("watched_at <= ?");
          params.push(range.lte.toISOString());
        }
      }

      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(" AND ")}`;
      }

      sql += ` ORDER BY watched_at ${orderBy?.watchedAt === "asc" ? "ASC" : "DESC"}`;
      if (take) {
        sql += ` LIMIT ${take}`;
      }

      const rows = db.prepare(sql).all(...params).map((row) => toCamel(row) as Record<string, unknown>);
      if (!include?.contentTags) {
        return Promise.resolve(rows);
      }

      return Promise.resolve(
        rows.map((row) => ({
          ...row,
          contentTags: db
            .prepare("SELECT * FROM content_tags WHERE watch_history_item_id = ? ORDER BY created_at ASC")
            .all(row.id)
            .map((item) => toCamel(item)),
        })),
      );
    },
    update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const existing = toCamel(db.prepare("SELECT * FROM watch_history_items WHERE id = ?").get(where.id)) as Record<string, unknown> | null;
      if (!existing) {
        throw new Error("WatchHistoryItem not found.");
      }

      const merged = { ...existing, ...data };
      db.prepare(
        `UPDATE watch_history_items SET
          summary = @summary,
          tag_status = @tagStatus,
          updated_at = @updatedAt
        WHERE id = @id`,
      ).run({
        id: where.id,
        summary: merged.summary ?? null,
        tagStatus: merged.tagStatus ?? existing.tagStatus,
        updatedAt: nowIso(),
      });

      return Promise.resolve(toCamel(db.prepare("SELECT * FROM watch_history_items WHERE id = ?").get(where.id)));
    },
  },
  contentTag: {
    deleteMany({ where }: { where: { watchHistoryItemId: string } }) {
      db.prepare("DELETE FROM content_tags WHERE watch_history_item_id = ?").run(where.watchHistoryItemId);
      return Promise.resolve();
    },
    createMany({ data }: { data: Array<Record<string, unknown>> }) {
      const statement = db.prepare(
        `INSERT INTO content_tags (
          id, watch_history_item_id, label, source, confidence, summary, created_at
        ) VALUES (
          @id, @watchHistoryItemId, @label, @source, @confidence, @summary, @createdAt
        )`,
      );
      const insert = db.transaction((entries: Array<Record<string, unknown>>) => {
        for (const entry of entries) {
          statement.run({
            id: randomUUID(),
            watchHistoryItemId: entry.watchHistoryItemId,
            label: entry.label,
            source: entry.source,
            confidence: entry.confidence ?? null,
            summary: entry.summary ?? null,
            createdAt: nowIso(),
          });
        }
      });
      insert(data);
      return Promise.resolve();
    },
  },
  dailySnapshot: {
    upsert({ where, update, create }: { where: { date: Date }; update: Record<string, unknown>; create: Record<string, unknown> }) {
      const dateIso = where.date.toISOString();
      const existing = db.prepare("SELECT * FROM daily_snapshots WHERE date = ?").get(dateIso);
      const timestamp = nowIso();
      const data = existing ? update : create;

      if (existing) {
        db.prepare(
          `UPDATE daily_snapshots SET
            window_start = @windowStart, window_end = @windowEnd, total_videos = @totalVideos,
            total_duration = @totalDuration, avg_duration = @avgDuration, unique_authors = @uniqueAuthors,
            unique_topics = @uniqueTopics, active_hours = @activeHours, topic_distribution = @topicDistribution,
            zone_distribution = @zoneDistribution, author_distribution = @authorDistribution,
            novelty_ratio = @noveltyRatio, metrics = @metrics, updated_at = @updatedAt
          WHERE date = @date`,
        ).run({
          date: dateIso,
          windowStart: serializeDate(data.windowStart),
          windowEnd: serializeDate(data.windowEnd),
          totalVideos: data.totalVideos,
          totalDuration: data.totalDuration,
          avgDuration: data.avgDuration ?? 0,
          uniqueAuthors: data.uniqueAuthors,
          uniqueTopics: data.uniqueTopics,
          activeHours: data.activeHours,
          topicDistribution: data.topicDistribution,
          zoneDistribution: data.zoneDistribution,
          authorDistribution: data.authorDistribution,
          noveltyRatio: data.noveltyRatio ?? null,
          metrics: data.metrics,
          updatedAt: timestamp,
        });
      } else {
        db.prepare(
          `INSERT INTO daily_snapshots (
            id, date, window_start, window_end, total_videos, total_duration, avg_duration,
            unique_authors, unique_topics, active_hours, topic_distribution, zone_distribution,
            author_distribution, novelty_ratio, metrics, created_at, updated_at
          ) VALUES (
            @id, @date, @windowStart, @windowEnd, @totalVideos, @totalDuration, @avgDuration,
            @uniqueAuthors, @uniqueTopics, @activeHours, @topicDistribution, @zoneDistribution,
            @authorDistribution, @noveltyRatio, @metrics, @createdAt, @updatedAt
          )`,
        ).run({
          id: randomUUID(),
          date: dateIso,
          windowStart: serializeDate(data.windowStart),
          windowEnd: serializeDate(data.windowEnd),
          totalVideos: data.totalVideos,
          totalDuration: data.totalDuration,
          avgDuration: data.avgDuration ?? 0,
          uniqueAuthors: data.uniqueAuthors,
          uniqueTopics: data.uniqueTopics,
          activeHours: data.activeHours,
          topicDistribution: data.topicDistribution,
          zoneDistribution: data.zoneDistribution,
          authorDistribution: data.authorDistribution,
          noveltyRatio: data.noveltyRatio ?? null,
          metrics: data.metrics,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      return Promise.resolve(toCamel(db.prepare("SELECT * FROM daily_snapshots WHERE date = ?").get(dateIso)));
    },
    update({ where, data }: { where: { date: Date }; data: Record<string, unknown> }) {
      return prisma.dailySnapshot.upsert({
        where,
        update: data,
        create: { date: where.date, ...data },
      });
    },
  },
  weeklySnapshot: {
    upsert({ where, update, create }: { where: { weekKey: string }; update: Record<string, unknown>; create: Record<string, unknown> }) {
      const existing = db.prepare("SELECT * FROM weekly_snapshots WHERE week_key = ?").get(where.weekKey);
      const timestamp = nowIso();
      const data = existing ? update : create;

      if (existing) {
        db.prepare(
          `UPDATE weekly_snapshots SET
            window_start = @windowStart, window_end = @windowEnd, total_videos = @totalVideos,
            total_duration = @totalDuration, avg_duration = @avgDuration, unique_authors = @uniqueAuthors,
            unique_topics = @uniqueTopics, active_hours = @activeHours, topic_distribution = @topicDistribution,
            zone_distribution = @zoneDistribution, author_distribution = @authorDistribution,
            novelty_ratio = @noveltyRatio, metrics = @metrics, updated_at = @updatedAt
          WHERE week_key = @weekKey`,
        ).run({
          weekKey: where.weekKey,
          windowStart: serializeDate(data.windowStart),
          windowEnd: serializeDate(data.windowEnd),
          totalVideos: data.totalVideos,
          totalDuration: data.totalDuration,
          avgDuration: data.avgDuration ?? 0,
          uniqueAuthors: data.uniqueAuthors,
          uniqueTopics: data.uniqueTopics,
          activeHours: data.activeHours,
          topicDistribution: data.topicDistribution,
          zoneDistribution: data.zoneDistribution,
          authorDistribution: data.authorDistribution,
          noveltyRatio: data.noveltyRatio ?? null,
          metrics: data.metrics,
          updatedAt: timestamp,
        });
      } else {
        db.prepare(
          `INSERT INTO weekly_snapshots (
            id, week_key, window_start, window_end, total_videos, total_duration, avg_duration,
            unique_authors, unique_topics, active_hours, topic_distribution, zone_distribution,
            author_distribution, novelty_ratio, metrics, created_at, updated_at
          ) VALUES (
            @id, @weekKey, @windowStart, @windowEnd, @totalVideos, @totalDuration, @avgDuration,
            @uniqueAuthors, @uniqueTopics, @activeHours, @topicDistribution, @zoneDistribution,
            @authorDistribution, @noveltyRatio, @metrics, @createdAt, @updatedAt
          )`,
        ).run({
          id: randomUUID(),
          weekKey: where.weekKey,
          windowStart: serializeDate(data.windowStart),
          windowEnd: serializeDate(data.windowEnd),
          totalVideos: data.totalVideos,
          totalDuration: data.totalDuration,
          avgDuration: data.avgDuration ?? 0,
          uniqueAuthors: data.uniqueAuthors,
          uniqueTopics: data.uniqueTopics,
          activeHours: data.activeHours,
          topicDistribution: data.topicDistribution,
          zoneDistribution: data.zoneDistribution,
          authorDistribution: data.authorDistribution,
          noveltyRatio: data.noveltyRatio ?? null,
          metrics: data.metrics,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      return Promise.resolve(toCamel(db.prepare("SELECT * FROM weekly_snapshots WHERE week_key = ?").get(where.weekKey)));
    },
  },
  dailyReport: {
    findFirst({ orderBy }: { orderBy: { date: "asc" | "desc" } }) {
      return Promise.resolve(toCamel(db.prepare(`SELECT * FROM daily_reports ORDER BY date ${orderBy.date.toUpperCase()} LIMIT 1`).get()));
    },
    findMany({ orderBy, take }: { orderBy: { date: "asc" | "desc" }; take: number }) {
      return Promise.resolve(
        db.prepare(`SELECT * FROM daily_reports ORDER BY date ${orderBy.date.toUpperCase()} LIMIT ?`).all(take).map((row) => toCamel(row)),
      );
    },
    findUnique({ where }: { where: { date: Date } }) {
      return Promise.resolve(toCamel(db.prepare("SELECT * FROM daily_reports WHERE date = ?").get(where.date.toISOString())));
    },
    upsert({ where, update, create }: { where: { date: Date }; update: Record<string, unknown>; create: Record<string, unknown> }) {
      const dateIso = where.date.toISOString();
      const existing = db.prepare("SELECT * FROM daily_reports WHERE date = ?").get(dateIso);
      const timestamp = nowIso();
      const data = existing ? update : create;
      const payload = serializeBaseReport(data, timestamp);

      if (existing) {
        db.prepare(
          `UPDATE daily_reports SET
            summary = @summary, body = @body, coconon_score = @cocononScore, coconon_level = @cocononLevel,
            comparison_label = @comparisonLabel, comparison_target = @comparisonTarget,
            comparison_breakdown = @comparisonBreakdown, evidence = @evidence, metrics = @metrics,
            sample_sufficient = @sampleSufficient, updated_at = @updatedAt
          WHERE date = @date`,
        ).run({
          date: dateIso,
          ...payload,
        });
      } else {
        db.prepare(
          `INSERT INTO daily_reports (
            id, date, summary, body, coconon_score, coconon_level, comparison_label,
            comparison_target, comparison_breakdown, evidence, metrics, sample_sufficient, created_at, updated_at
          ) VALUES (
            @id, @date, @summary, @body, @cocononScore, @cocononLevel, @comparisonLabel,
            @comparisonTarget, @comparisonBreakdown, @evidence, @metrics, @sampleSufficient, @createdAt, @updatedAt
          )`,
        ).run({
          id: randomUUID(),
          date: dateIso,
          ...payload,
          createdAt: timestamp,
        });
      }

      return Promise.resolve(toCamel(db.prepare("SELECT * FROM daily_reports WHERE date = ?").get(dateIso)));
    },
  },
  weeklyReport: {
    findFirst({ orderBy }: { orderBy: { windowStart: "asc" | "desc" } }) {
      return Promise.resolve(toCamel(db.prepare(`SELECT * FROM weekly_reports ORDER BY window_start ${orderBy.windowStart.toUpperCase()} LIMIT 1`).get()));
    },
    findMany({ orderBy, take }: { orderBy: { windowStart: "asc" | "desc" }; take: number }) {
      return Promise.resolve(
        db.prepare(`SELECT * FROM weekly_reports ORDER BY window_start ${orderBy.windowStart.toUpperCase()} LIMIT ?`).all(take).map((row) => toCamel(row)),
      );
    },
    findUnique({ where }: { where: { weekKey: string } }) {
      return Promise.resolve(toCamel(db.prepare("SELECT * FROM weekly_reports WHERE week_key = ?").get(where.weekKey)));
    },
    upsert({ where, update, create }: { where: { weekKey: string }; update: Record<string, unknown>; create: Record<string, unknown> }) {
      const existing = db.prepare("SELECT * FROM weekly_reports WHERE week_key = ?").get(where.weekKey);
      const timestamp = nowIso();
      const data = existing ? update : create;
      const payload = serializeBaseReport(data, timestamp);

      if (existing) {
        db.prepare(
          `UPDATE weekly_reports SET
            window_start = @windowStart, window_end = @windowEnd, summary = @summary, body = @body,
            coconon_score = @cocononScore, coconon_level = @cocononLevel,
            comparison_label = @comparisonLabel, comparison_target = @comparisonTarget,
            comparison_breakdown = @comparisonBreakdown, evidence = @evidence, metrics = @metrics,
            sample_sufficient = @sampleSufficient, updated_at = @updatedAt
          WHERE week_key = @weekKey`,
        ).run({
          weekKey: where.weekKey,
          windowStart: serializeDate(data.windowStart),
          windowEnd: serializeDate(data.windowEnd),
          ...payload,
        });
      } else {
        db.prepare(
          `INSERT INTO weekly_reports (
            id, week_key, window_start, window_end, summary, body, coconon_score, coconon_level,
            comparison_label, comparison_target, comparison_breakdown, evidence, metrics,
            sample_sufficient, created_at, updated_at
          ) VALUES (
            @id, @weekKey, @windowStart, @windowEnd, @summary, @body, @cocononScore, @cocononLevel,
            @comparisonLabel, @comparisonTarget, @comparisonBreakdown, @evidence, @metrics,
            @sampleSufficient, @createdAt, @updatedAt
          )`,
        ).run({
          id: randomUUID(),
          weekKey: where.weekKey,
          windowStart: serializeDate(data.windowStart),
          windowEnd: serializeDate(data.windowEnd),
          ...payload,
          createdAt: timestamp,
        });
      }

      return Promise.resolve(toCamel(db.prepare("SELECT * FROM weekly_reports WHERE week_key = ?").get(where.weekKey)));
    },
  },
  jobRun: {
    create({ data }: { data: Record<string, unknown> }) {
      const timestamp = nowIso();
      const id = randomUUID();
      db.prepare(
        `INSERT INTO job_runs (
          id, job_type, status, trigger, duration_ms, started_at, finished_at, error_message, details
        ) VALUES (
          @id, @jobType, @status, @trigger, @durationMs, @startedAt, @finishedAt, @errorMessage, @details
        )`,
      ).run({
        id,
        jobType: data.jobType,
        status: data.status ?? JobStatus.RUNNING,
        trigger: data.trigger,
        durationMs: data.durationMs ?? null,
        startedAt: timestamp,
        finishedAt: null,
        errorMessage: data.errorMessage ?? null,
        details: data.details ?? null,
      });
      return Promise.resolve(toCamel(db.prepare("SELECT * FROM job_runs WHERE id = ?").get(id)));
    },
    update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
      const existing = toCamel(db.prepare("SELECT * FROM job_runs WHERE id = ?").get(where.id)) as Record<string, unknown> | null;
      if (!existing) {
        throw new Error("JobRun not found.");
      }

      db.prepare(
        `UPDATE job_runs SET
          status = @status,
          duration_ms = @durationMs,
          finished_at = @finishedAt,
          error_message = @errorMessage,
          details = @details
        WHERE id = @id`,
      ).run({
        id: where.id,
        status: data.status ?? existing.status ?? JobStatus.RUNNING,
        durationMs: data.durationMs ?? null,
        finishedAt: serializeDate(data.finishedAt),
        errorMessage: data.errorMessage ?? null,
        details: data.details ?? null,
      });
      return Promise.resolve(toCamel(db.prepare("SELECT * FROM job_runs WHERE id = ?").get(where.id)));
    },
    findMany({ orderBy, take }: { orderBy: { startedAt: "asc" | "desc" }; take: number }) {
      return Promise.resolve(
        db.prepare(`SELECT * FROM job_runs ORDER BY started_at ${orderBy.startedAt.toUpperCase()} LIMIT ?`).all(take).map((row) => toCamel(row)),
      );
    },
  },
};

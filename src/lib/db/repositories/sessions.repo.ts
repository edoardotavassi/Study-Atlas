import { getDb } from '../client';
import type { Session } from '../../domain/types';
import { nanoid } from '../utils';

export interface CreateSessionInput {
    subject_id: string;
    start_ts: number;
    end_ts: number;
    duration_min: number;
    outcome: 'done' | 'partial' | 'stuck';
    focus?: number | null;
    note?: string | null;
    topic_ids?: string[];
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
    const db = await getDb();
    const id = nanoid();
    const now = Date.now();

    await db.execute(
        `INSERT INTO sessions (id, subject_id, start_ts, end_ts, duration_min, outcome, focus, note, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, input.subject_id, input.start_ts, input.end_ts, input.duration_min,
            input.outcome, input.focus ?? null, input.note ?? null, now]
    );

    // Link topics
    if (input.topic_ids?.length) {
        for (const tid of input.topic_ids) {
            await db.execute(
                'INSERT OR IGNORE INTO session_topics (session_id, topic_id) VALUES ($1, $2)',
                [id, tid]
            );
        }
    }

    return {
        id, subject_id: input.subject_id, start_ts: input.start_ts, end_ts: input.end_ts,
        duration_min: input.duration_min, outcome: input.outcome,
        focus: input.focus ?? null, note: input.note ?? null, created_at: now
    };
}

export async function updateSession(id: string, input: CreateSessionInput): Promise<Session> {
    const db = await getDb();

    await db.execute(
        `UPDATE sessions 
         SET subject_id = $1, start_ts = $2, end_ts = $3, duration_min = $4, 
             outcome = $5, focus = $6, note = $7
         WHERE id = $8`,
        [input.subject_id, input.start_ts, input.end_ts, input.duration_min,
        input.outcome, input.focus ?? null, input.note ?? null, id]
    );

    // Sync topics
    await db.execute('DELETE FROM session_topics WHERE session_id = $1', [id]);
    if (input.topic_ids?.length) {
        for (const tid of input.topic_ids) {
            await db.execute(
                'INSERT OR IGNORE INTO session_topics (session_id, topic_id) VALUES ($1, $2)',
                [id, tid]
            );
        }
    }

    return {
        id, subject_id: input.subject_id, start_ts: input.start_ts, end_ts: input.end_ts,
        duration_min: input.duration_min, outcome: input.outcome,
        focus: input.focus ?? null, note: input.note ?? null, created_at: Date.now()
    };
}

export async function getSessionsInRange(startMs: number, endMs: number): Promise<Session[]> {
    const db = await getDb();
    return db.select<Session[]>(
        `SELECT s.*, subj.name as subject_name, subj.color as subject_color
     FROM sessions s
     JOIN subjects subj ON s.subject_id = subj.id
     WHERE s.end_ts >= $1 AND s.end_ts <= $2
     ORDER BY s.end_ts DESC`,
        [startMs, endMs]
    );
}

export async function getSessionsBySubject(subjectId: string, startMs?: number, endMs?: number): Promise<Session[]> {
    const db = await getDb();
    if (startMs !== undefined && endMs !== undefined) {
        return db.select<Session[]>(
            `SELECT s.*, subj.name as subject_name, subj.color as subject_color
       FROM sessions s JOIN subjects subj ON s.subject_id = subj.id
       WHERE s.subject_id = $1 AND s.end_ts >= $2 AND s.end_ts <= $3
       ORDER BY s.end_ts DESC`,
            [subjectId, startMs, endMs]
        );
    }
    return db.select<Session[]>(
        `SELECT s.*, subj.name as subject_name, subj.color as subject_color
     FROM sessions s JOIN subjects subj ON s.subject_id = subj.id
     WHERE s.subject_id = $1
     ORDER BY s.end_ts DESC`,
        [subjectId]
    );
}

export async function deleteSession(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM sessions WHERE id = $1', [id]);
}

export interface DailyTotal {
    date: string;
    minutes: number;
    sessions: number;
}

export async function getDailyTotals(startMs: number, endMs: number): Promise<DailyTotal[]> {
    const db = await getDb();
    // SQLite: use date() with unixepoch to get local date
    const rows = await db.select<DailyTotal[]>(
        `SELECT date(start_ts/1000, 'unixepoch', 'localtime') as date,
            SUM(duration_min) as minutes,
            COUNT(*) as sessions
     FROM sessions
     WHERE start_ts >= $1 AND start_ts <= $2
     GROUP BY date ORDER BY date ASC`,
        [startMs, endMs]
    );
    return rows;
}

export async function getTopicsBySession(sessionId: string): Promise<import('../../domain/types').Topic[]> {
    const db = await getDb();
    return db.select(
        `SELECT t.* FROM topics t
     JOIN session_topics st ON t.id = st.topic_id
     WHERE st.session_id = $1`,
        [sessionId]
    );
}

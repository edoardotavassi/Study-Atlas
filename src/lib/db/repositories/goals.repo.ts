import { getDb } from '../client';
import type { Goal } from '../../domain/types';
import { nanoid } from '../utils';

export async function getGlobalGoal(): Promise<Goal | null> {
    const db = await getDb();
    const rows = await db.select<Goal[]>(
        'SELECT * FROM goals WHERE subject_id IS NULL ORDER BY created_at DESC LIMIT 1'
    );
    return rows[0] ?? null;
}

export async function setGlobalGoal(minutesPerWeek: number): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM goals WHERE subject_id IS NULL');
    await db.execute(
        'INSERT INTO goals (id, subject_id, minutes_per_week, created_at) VALUES ($1, NULL, $2, $3)',
        [nanoid(), minutesPerWeek, Date.now()]
    );
    // Also sync to settings for quick access
    await db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('goal.weeklyMinutes', $1)",
        [String(minutesPerWeek)]
    );
}

export async function getSubjectGoal(subjectId: string): Promise<Goal | null> {
    const db = await getDb();
    const rows = await db.select<Goal[]>(
        'SELECT * FROM goals WHERE subject_id = $1 ORDER BY created_at DESC LIMIT 1',
        [subjectId]
    );
    return rows[0] ?? null;
}

export async function setSubjectGoal(subjectId: string, minutesPerWeek: number): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM goals WHERE subject_id = $1', [subjectId]);
    await db.execute(
        'INSERT INTO goals (id, subject_id, minutes_per_week, created_at) VALUES ($1, $2, $3, $4)',
        [nanoid(), subjectId, minutesPerWeek, Date.now()]
    );
}

export async function getSetting(key: string): Promise<string | null> {
    const db = await getDb();
    const rows = await db.select<{ value: string }[]>(
        'SELECT value FROM settings WHERE key = $1',
        [key]
    );
    return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)',
        [key, value]
    );
}

export async function getAllSettings(): Promise<Record<string, string>> {
    const db = await getDb();
    const rows = await db.select<{ key: string; value: string }[]>('SELECT key, value FROM settings');
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

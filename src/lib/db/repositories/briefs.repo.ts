import { getDb } from '../client';
import type { DailyBrief } from '../../domain/types';

export async function getBriefByDate(date: string): Promise<DailyBrief | null> {
    const db = await getDb();
    const rows = await db.select<DailyBrief[]>(
        'SELECT * FROM daily_briefs WHERE date = $1',
        [date]
    );
    return rows[0] ?? null;
}

export async function upsertBrief(date: string, source: 'deterministic' | 'llm', json: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'INSERT OR REPLACE INTO daily_briefs (date, source, json, created_at) VALUES ($1, $2, $3, $4)',
        [date, source, json, Date.now()]
    );
}

export async function deleteBriefByDate(date: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM daily_briefs WHERE date = $1', [date]);
}

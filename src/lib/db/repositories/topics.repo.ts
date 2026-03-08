import { getDb } from '../client';
import type { Topic } from '../../domain/types';
import { nanoid } from '../utils';

export async function listTopicsBySubject(subjectId: string): Promise<Topic[]> {
    const db = await getDb();
    return db.select<Topic[]>(
        'SELECT * FROM topics WHERE subject_id = $1 ORDER BY name ASC',
        [subjectId]
    );
}

export async function upsertTopic(subjectId: string, name: string): Promise<Topic> {
    const db = await getDb();
    const trimmed = name.trim();
    const existing = await db.select<Topic[]>(
        'SELECT * FROM topics WHERE subject_id = $1 AND name = $2',
        [subjectId, trimmed]
    );
    if (existing[0]) return existing[0];
    const id = nanoid();
    const now = Date.now();
    await db.execute(
        'INSERT OR IGNORE INTO topics (id, subject_id, name, created_at) VALUES ($1, $2, $3, $4)',
        [id, subjectId, trimmed, now]
    );
    const row = await db.select<Topic[]>(
        'SELECT * FROM topics WHERE subject_id = $1 AND name = $2',
        [subjectId, trimmed]
    );
    return row[0] ?? { id, subject_id: subjectId, name: trimmed, created_at: now };
}

export async function renameTopic(id: string, newName: string): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE topics SET name = $1 WHERE id = $2', [newName.trim(), id]);
}

export async function deleteTopic(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM topics WHERE id = $1', [id]);
}

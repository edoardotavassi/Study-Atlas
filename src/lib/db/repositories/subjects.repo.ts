import { getDb } from '../client';
import type { Subject } from '../../domain/types';
import { nanoid } from '../utils';

export async function listSubjects(): Promise<Subject[]> {
    const db = await getDb();
    return db.select<Subject[]>('SELECT * FROM subjects ORDER BY archived ASC, name ASC');
}

export async function listActiveSubjects(): Promise<Subject[]> {
    const db = await getDb();
    return db.select<Subject[]>('SELECT * FROM subjects WHERE archived = 0 ORDER BY name ASC');
}

export async function getSubject(id: string): Promise<Subject | null> {
    const db = await getDb();
    const rows = await db.select<Subject[]>('SELECT * FROM subjects WHERE id = $1', [id]);
    return rows[0] ?? null;
}

export async function createSubject(name: string, color: string | null = null): Promise<Subject> {
    const db = await getDb();
    const id = nanoid();
    const now = Date.now();
    await db.execute(
        'INSERT INTO subjects (id, name, color, archived, passed_at, created_at) VALUES ($1, $2, $3, 0, NULL, $4)',
        [id, name.trim(), color, now]
    );
    return { id, name: name.trim(), color, archived: 0, passed_at: null, created_at: now };
}

export async function upsertSubjectByName(name: string): Promise<Subject> {
    const db = await getDb();
    const existing = await db.select<Subject[]>(
        'SELECT * FROM subjects WHERE name = $1',
        [name.trim()]
    );
    if (existing[0]) return existing[0];
    return createSubject(name);
}

export async function renameSubject(id: string, newName: string): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE subjects SET name = $1 WHERE id = $2', [newName.trim(), id]);
}

export async function updateSubjectColor(id: string, color: string): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE subjects SET color = $1 WHERE id = $2', [color, id]);
}

export async function archiveSubject(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE subjects SET archived = 1, passed_at = $1 WHERE id = $2', [Date.now(), id]);
}

export async function unarchiveSubject(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE subjects SET archived = 0, passed_at = NULL WHERE id = $1', [id]);
}

export async function deleteSubject(id: string): Promise<void> {
    const db = await getDb();
    // CASCADE handles sessions, topics, session_topics, goals
    await db.execute('DELETE FROM subjects WHERE id = $1', [id]);
}

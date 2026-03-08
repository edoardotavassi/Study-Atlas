// DB client — opens SQLite and runs migrations
import Database from '@tauri-apps/plugin-sql';
import { runMigrations } from './migrations';

let _db: Database | null = null;
let _readyPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
    if (_db) return _db;
    if (_readyPromise) return _readyPromise;

    _readyPromise = (async () => {
        const db = await Database.load('sqlite:study-atlas.db');
        await runMigrations(db);
        _db = db;
        return db;
    })();

    return _readyPromise;
}

export type DB = Database;

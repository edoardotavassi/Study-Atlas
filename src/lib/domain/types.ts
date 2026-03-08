// Domain Types for Study Atlas

export interface Subject {
    id: string;
    name: string;
    color: string | null;
    archived: number; // 0 = active, 1 = passed
    passed_at: number | null;
    created_at: number;
}

export interface Topic {
    id: string;
    subject_id: string;
    name: string;
    created_at: number;
}

export type Outcome = 'done' | 'partial' | 'stuck';

export interface Session {
    id: string;
    subject_id: string;
    start_ts: number;
    end_ts: number;
    duration_min: number;
    outcome: Outcome;
    focus: number | null; // 1-5
    note: string | null;
    created_at: number;
    // Joined fields
    subject_name?: string;
    subject_color?: string | null;
    topics?: Topic[];
}

export interface Goal {
    id: string;
    subject_id: string | null; // null = global
    minutes_per_week: number;
    created_at: number;
}

export interface AppSetting {
    key: string;
    value: string;
}

export interface DailyBrief {
    date: string; // YYYY-MM-DD
    source: 'deterministic' | 'llm';
    json: string;
    created_at: number;
}

// Plan types
export interface PlanBlock {
    minutes: number;
    subject: string;
    topics: string[];
    task: string;
}

export interface PlanMeta {
    source: 'deterministic' | 'llm';
    model?: string;
}

export interface PlanJSON {
    blocks: PlanBlock[];
    risk: string;
    reasoning: string;
    startNow: string;
    meta?: PlanMeta;
}

// Analytics types
export interface TodayMetrics {
    minutesLogged: number;
    sessionsCount: number;
    focusAvg: number | null;
    weeklyProgressPercent: number;
    weeklyGoalMinutes: number;
    weeklyMinutes: number;
    streak: number;
}

export interface SubjectStat {
    subject: Subject;
    minutesThisWeek: number;
    minutesLastWeek: number;
    lastStudiedDate: string | null;
    stuckRateLast14: number;
    topTopics: string[];
    sparklineWeeks: number[]; // last 8 weeks, minutes each
}

export interface HeatmapDay {
    date: string;      // YYYY-MM-DD
    minutes: number;
    sessions: number;
    topSubjects: string[];
}

export interface InsightsData {
    totalLast7d: number;
    subjectBalance: { name: string; minutes: number; color: string | null }[];
    stuckTopics: { topic: string; subject: string; count: number }[];
    streak: number;
    studyDaysLast30: number;
}

// Runtime validator for PlanJSON
export function validatePlan(plan: unknown): PlanJSON | null {
    try {
        const p = plan as PlanJSON;
        if (!p || typeof p !== 'object') return null;
        if (!Array.isArray(p.blocks) || p.blocks.length !== 3) return null;
        for (const b of p.blocks) {
            if (!b || typeof b !== 'object') return null;
            if (!Number.isInteger(b.minutes) || b.minutes <= 0) return null;
            if (!b.subject || typeof b.subject !== 'string' || b.subject.trim() === '') return null;
            if (!Array.isArray(b.topics)) return null;
            if (!b.task || typeof b.task !== 'string' || b.task.trim() === '') return null;
        }
        if (typeof p.risk !== 'string') return null;
        if (typeof p.startNow !== 'string') return null;
        return p;
    } catch {
        return null;
    }
}

import { getDb } from '../db/client';
import { dayStart, dayEnd, weekStart, weekEnd, daysAgo, toDateStr } from '../db/utils';
import type { TodayMetrics, HeatmapDay, SubjectStat, InsightsData } from './types';
import { listSubjects } from '../db/repositories/subjects.repo';
import { getDailyTotals, getSessionsInRange } from '../db/repositories/sessions.repo';
import { getSetting } from '../db/repositories/goals.repo';

export async function getTodayMetrics(): Promise<TodayMetrics> {
    const db = await getDb();
    const now = new Date();
    const todayStart = dayStart(now);
    const todayEnd = dayEnd(now);
    const wStart = weekStart(now);
    const wEnd = weekEnd(now);

    // today
    const todayRows = await db.select<{ total_min: number; count: number; avg_focus: number | null }[]>(
        `SELECT SUM(duration_min) as total_min, COUNT(*) as count, AVG(focus) as avg_focus
     FROM sessions WHERE end_ts >= $1 AND end_ts <= $2`,
        [todayStart, todayEnd]
    );
    const today = todayRows[0] ?? { total_min: 0, count: 0, avg_focus: null };

    // weekly
    const weekRows = await db.select<{ total_min: number }[]>(
        `SELECT SUM(duration_min) as total_min FROM sessions WHERE end_ts >= $1 AND end_ts <= $2`,
        [wStart, wEnd]
    );
    const weeklyMinutes = weekRows[0]?.total_min ?? 0;

    // weekly goal
    const goalStr = await getSetting('goal.weeklyMinutes');
    const goalMin = parseInt(goalStr ?? '1200', 10);

    // streak: consecutive days with at least 1 session
    const streak = await computeStreak(db);

    return {
        minutesLogged: today.total_min ?? 0,
        sessionsCount: today.count ?? 0,
        focusAvg: today.avg_focus != null ? Math.round((today.avg_focus / 5) * 100) : null,
        weeklyProgressPercent: goalMin > 0 ? Math.min(100, Math.round((weeklyMinutes / goalMin) * 100)) : 0,
        weeklyGoalMinutes: goalMin,
        weeklyMinutes: weeklyMinutes ?? 0,
        streak,
    };
}

async function computeStreak(db: Awaited<ReturnType<typeof getDb>>): Promise<number> {
    const rows = await db.select<{ date: string }[]>(
        `SELECT DISTINCT date(start_ts/1000, 'unixepoch', 'localtime') as date
     FROM sessions ORDER BY date DESC LIMIT 60`
    );
    if (!rows.length) return 0;
    let streak = 0;
    const today = toDateStr(new Date());
    let checkDate = new Date();
    // Allow today or yesterday to start streak
    const dates = new Set(rows.map(r => r.date));
    if (!dates.has(today)) {
        const yesterday = toDateStr(new Date(Date.now() - 86400000));
        if (!dates.has(yesterday)) return 0;
        checkDate = new Date(Date.now() - 86400000);
    }
    while (dates.has(toDateStr(checkDate))) {
        streak++;
        checkDate = new Date(checkDate.getTime() - 86400000);
    }
    return streak;
}

export async function getHeatmapData(year: number, month: number): Promise<HeatmapDay[]> {
    const db = await getDb();
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0, 23, 59, 59, 999);

    const rows = await db.select<{ date: string; minutes: number; sessions: number }[]>(
        `SELECT date(end_ts/1000, 'unixepoch', 'localtime') as date,
            SUM(duration_min) as minutes, COUNT(*) as sessions
     FROM sessions
     WHERE end_ts >= $1 AND end_ts <= $2
     GROUP BY date`,
        [firstDay.getTime(), lastDay.getTime()]
    );

    const result: HeatmapDay[] = [];
    for (const row of rows) {
        const subjectRows = await db.select<{ name: string }[]>(
            `SELECT DISTINCT subj.name FROM sessions s
       JOIN subjects subj ON s.subject_id = subj.id
       WHERE date(s.end_ts/1000, 'unixepoch', 'localtime') = $1
       LIMIT 3`,
            [row.date]
        );
        result.push({
            date: row.date,
            minutes: row.minutes ?? 0,
            sessions: row.sessions ?? 0,
            topSubjects: subjectRows.map(r => r.name),
        });
    }
    return result;
}

export async function getSubjectStats(): Promise<SubjectStat[]> {
    const db = await getDb();
    const subjects = await listSubjects();
    const now = new Date();
    const wStart = weekStart(now);
    const wEnd = weekEnd(now);
    const lastWeekStart = wStart - 7 * 24 * 60 * 60 * 1000;
    const lastWeekEnd = wStart - 1;
    const fourteenDaysAgo = daysAgo(14);
    const thirtyDaysAgo = daysAgo(30);

    const stats: SubjectStat[] = [];
    for (const subject of subjects) {
        // This week
        const thisWeek = await db.select<{ m: number }[]>(
            `SELECT SUM(duration_min) as m FROM sessions WHERE subject_id = $1 AND start_ts >= $2 AND start_ts <= $3`,
            [subject.id, wStart, wEnd]
        );
        // Last week
        const lastWeek = await db.select<{ m: number }[]>(
            `SELECT SUM(duration_min) as m FROM sessions WHERE subject_id = $1 AND start_ts >= $2 AND start_ts <= $3`,
            [subject.id, lastWeekStart, lastWeekEnd]
        );
        // Last studied
        const lastStudied = await db.select<{ date: string }[]>(
            `SELECT date(start_ts/1000, 'unixepoch', 'localtime') as date FROM sessions
       WHERE subject_id = $1 ORDER BY start_ts DESC LIMIT 1`,
            [subject.id]
        );
        // Stuck rate last 14d
        const stuckData = await db.select<{ total: number; stuck: number }[]>(
            `SELECT COUNT(*) as total,
              SUM(CASE WHEN outcome = 'stuck' THEN 1 ELSE 0 END) as stuck
       FROM sessions WHERE subject_id = $1 AND end_ts >= $2`,
            [subject.id, fourteenDaysAgo]
        );
        const stuckRate = stuckData[0]?.total > 0
            ? (stuckData[0].stuck ?? 0) / stuckData[0].total
            : 0;

        // Top topics last 30d
        const topTopics = await db.select<{ name: string }[]>(
            `SELECT t.name FROM session_topics st
       JOIN topics t ON st.topic_id = t.id
       JOIN sessions s ON st.session_id = s.id
       WHERE s.subject_id = $1 AND s.end_ts >= $2
       GROUP BY t.id ORDER BY SUM(s.duration_min) DESC LIMIT 3`,
            [subject.id, thirtyDaysAgo]
        );

        // Sparkline: last 8 weeks
        const sparkline: number[] = [];
        for (let i = 7; i >= 0; i--) {
            const wS = wStart - i * 7 * 24 * 60 * 60 * 1000;
            const wE = wS + 7 * 24 * 60 * 60 * 1000 - 1;
            const r = await db.select<{ m: number }[]>(
                `SELECT SUM(duration_min) as m FROM sessions WHERE subject_id = $1 AND end_ts >= $2 AND end_ts <= $3`,
                [subject.id, wS, wE]
            );
            sparkline.push(r[0]?.m ?? 0);
        }

        stats.push({
            subject,
            minutesThisWeek: thisWeek[0]?.m ?? 0,
            minutesLastWeek: lastWeek[0]?.m ?? 0,
            lastStudiedDate: lastStudied[0]?.date ?? null,
            stuckRateLast14: Math.round(stuckRate * 100),
            topTopics: topTopics.map(t => t.name),
            sparklineWeeks: sparkline,
        });
    }
    return stats;
}

export async function getInsightsData(): Promise<InsightsData> {
    const db = await getDb();
    const sevenDaysAgo = daysAgo(7);
    const thirtyDaysAgo = daysAgo(30);

    // Total last 7d
    const total7d = await db.select<{ m: number }[]>(
        `SELECT SUM(duration_min) as m FROM sessions WHERE start_ts >= $1`,
        [sevenDaysAgo]
    );

    // Subject balance
    const subjects = await listSubjects();
    const balance = await db.select<{ name: string; minutes: number; subject_id: string }[]>(
        `SELECT subj.name, SUM(s.duration_min) as minutes, s.subject_id
     FROM sessions s JOIN subjects subj ON s.subject_id = subj.id
     WHERE s.start_ts >= $1
     GROUP BY s.subject_id ORDER BY minutes DESC LIMIT 6`,
        [sevenDaysAgo]
    );
    const subjectBalance = balance.map(b => ({
        name: b.name,
        minutes: b.minutes ?? 0,
        color: subjects.find(s => s.id === b.subject_id)?.color ?? null,
    }));

    // Stuck topics
    const stuckTopics = await db.select<{ topic: string; subject: string; count: number }[]>(
        `SELECT t.name as topic, subj.name as subject, COUNT(*) as count
     FROM session_topics st
     JOIN topics t ON st.topic_id = t.id
     JOIN sessions s ON st.session_id = s.id
     JOIN subjects subj ON s.subject_id = subj.id
     WHERE s.outcome = 'stuck' AND s.start_ts >= $1
     GROUP BY t.id ORDER BY count DESC LIMIT 5`,
        [thirtyDaysAgo]
    );

    // Study days last 30d
    const studyDays = await db.select<{ cnt: number }[]>(
        `SELECT COUNT(DISTINCT date(end_ts/1000, 'unixepoch', 'localtime')) as cnt
     FROM sessions WHERE end_ts >= $1`,
        [thirtyDaysAgo]
    );

    const streak = await computeStreak(db);

    return {
        totalLast7d: total7d[0]?.m ?? 0,
        subjectBalance,
        stuckTopics,
        streak,
        studyDaysLast30: studyDays[0]?.cnt ?? 0,
    };
}

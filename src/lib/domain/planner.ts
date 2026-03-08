import { getDb } from '../db/client';
import { daysAgo, weekStart, weekEnd } from '../db/utils';
import type { PlanJSON, PlanBlock } from './types';
import { listActiveSubjects } from '../db/repositories/subjects.repo';


interface SubjectScore {
    id: string;
    name: string;
    neglectDays: number;
    stuckRate: number;
    weeklyShare: number;
    score: number;
    topTopics: string[];
}

export async function generateDeterministicPlan(): Promise<PlanJSON> {
    const db = await getDb();
    const subjects = await listActiveSubjects();

    // Empty-data fallback
    if (subjects.length === 0) {
        return {
            blocks: [
                { minutes: 25, subject: 'Any', topics: [], task: 'Log your first 25m session' },
                { minutes: 25, subject: 'Any', topics: [], task: 'Create your first subject' },
                { minutes: 25, subject: 'Any', topics: [], task: 'Add 1 topic chip to a session' },
            ],
            risk: 'No data yet — start logging to unlock insights',
            reasoning: 'No study sessions have been logged yet. Once you start logging, the planner will analyse your neglect patterns, stuck rates, and time distribution to build a personalised daily plan.',
            startNow: 'Click "Start Session" to log your first study block',
            meta: { source: 'deterministic' },
        };
    }

    const now = new Date();
    const wStart = weekStart(now);
    const wEnd = weekEnd(now);
    const sevenDaysAgo = daysAgo(7);
    const fourteenDaysAgo = daysAgo(14);

    // Total minutes last 7d (for weeklyShare normalization)
    const totalMinsRow = await db.select<{ m: number }[]>(
        `SELECT SUM(duration_min) as m FROM sessions WHERE end_ts >= $1`,
        [sevenDaysAgo]
    );
    const totalMinutes = totalMinsRow[0]?.m ?? 0;

    const scores: SubjectScore[] = [];
    let maxNeglect = 0;

    for (const subj of subjects) {
        // neglectDays
        const lastRow = await db.select<{ ts: number }[]>(
            `SELECT MAX(start_ts) as ts FROM sessions WHERE subject_id = $1`,
            [subj.id]
        );
        const lastTs = lastRow[0]?.ts;
        const neglectDays = lastTs
            ? (Date.now() - lastTs) / (24 * 60 * 60 * 1000)
            : 999;
        maxNeglect = Math.max(maxNeglect, neglectDays);

        // stuckRate last 14d
        const stuckRow = await db.select<{ total: number; stuck: number }[]>(
            `SELECT COUNT(*) as total, SUM(CASE WHEN outcome='stuck' THEN 1 ELSE 0 END) as stuck
       FROM sessions WHERE subject_id = $1 AND end_ts >= $2`,
            [subj.id, fourteenDaysAgo]
        );
        const stuckRate = stuckRow[0]?.total > 0
            ? (stuckRow[0].stuck ?? 0) / stuckRow[0].total
            : 0;

        // weeklyShare
        const weekRow = await db.select<{ m: number }[]>(
            `SELECT SUM(duration_min) as m FROM sessions WHERE subject_id = $1 AND end_ts >= $2`,
            [subj.id, sevenDaysAgo]
        );
        const subjMins = weekRow[0]?.m ?? 0;
        const weeklyShare = totalMinutes > 0 ? subjMins / totalMinutes : 0;

        // Top topics (prefer stuck topics)
        const stuckTopicsRow = await db.select<{ name: string }[]>(
            `SELECT t.name FROM session_topics st
       JOIN topics t ON st.topic_id = t.id
       JOIN sessions s ON st.session_id = s.id
       WHERE s.subject_id = $1 AND s.outcome = 'stuck' AND s.end_ts >= $2
       GROUP BY t.id ORDER BY COUNT(*) DESC LIMIT 2`,
            [subj.id, fourteenDaysAgo]
        );
        let topTopics = stuckTopicsRow.map(r => r.name);

        if (topTopics.length === 0) {
            const recentTopicsRow = await db.select<{ name: string }[]>(
                `SELECT t.name FROM session_topics st
         JOIN topics t ON st.topic_id = t.id
         JOIN sessions s ON st.session_id = s.id
         WHERE s.subject_id = $1 ORDER BY s.start_ts DESC LIMIT 2`,
                [subj.id]
            );
            topTopics = recentTopicsRow.map(r => r.name);
        }

        scores.push({ id: subj.id, name: subj.name, neglectDays, stuckRate, weeklyShare, score: 0, topTopics });
    }

    // Normalize neglect and compute scores
    for (const s of scores) {
        const normNeglect = maxNeglect > 0 ? Math.min(1, s.neglectDays / maxNeglect) : 0;
        s.score = 0.55 * normNeglect + 0.35 * s.stuckRate + 0.10 * (1 - s.weeklyShare);
    }

    scores.sort((a, b) => b.score - a.score);

    const selected: SubjectScore[] = [];
    if (scores.length >= 1) selected.push(scores[0]);
    if (scores.length >= 2) selected.push(scores[1]);
    // maintenance: most neglected among remaining
    if (scores.length >= 3) {
        const maintenance = scores.slice(2).sort((a, b) => b.neglectDays - a.neglectDays)[0];
        selected.push(maintenance);
    } else if (scores.length === 1) {
        // Only one subject — repeat it with different focus
        selected.push({ ...scores[0], topTopics: [] });
        selected.push({ ...scores[0], topTopics: [] });
    } else if (scores.length === 2) {
        selected.push(scores[0]); // repeat top as maintenance
    }

    const durations = [50, 50, 25];
    const blocks: PlanBlock[] = selected.slice(0, 3).map((s, i) => ({
        minutes: durations[i] ?? 25,
        subject: s.name,
        topics: s.topTopics,
        task: buildTask(s),
    }));

    // Risk: find most neglected subject
    const mostNeglected = scores[0];
    const risk = mostNeglected.neglectDays > 2
        ? `${mostNeglected.name} neglected for ${Math.floor(mostNeglected.neglectDays)} day${Math.floor(mostNeglected.neglectDays) > 1 ? 's' : ''}`
        : scores.find(s => s.stuckRate > 0.3)
            ? `High stuck rate in ${scores.find(s => s.stuckRate > 0.3)!.name}`
            : 'On track — keep your consistency';

    // Reasoning: generate an engaging, colloquial explanation
    let reasoning = "";
    const primary = selected[0];
    const secondary = selected[1];

    if (primary.stuckRate > 0.3) {
        reasoning = `We need to unblock ${primary.name}. You've been stuck on it recently, so the first block is focused on active recall. `;
    } else if (primary.neglectDays > 2) {
        reasoning = `${primary.name} is starting to slip through the cracks—let's tackle it fresh while your focus is highest. `;
    } else {
        reasoning = `You're crushing ${primary.name} lately. We're kicking off with it to ride that momentum. `;
    }

    if (secondary) {
        if (secondary.stuckRate > 0.3) {
            reasoning += `Then we'll pivot to ${secondary.name} to clear up some friction you had last week. `;
        } else if (secondary.weeklyShare < 0.1) {
            reasoning += `I've added a solid 50m block of ${secondary.name} since it hasn't gotten much love this week. `;
        } else if (secondary.id === primary.id) {
            reasoning += `We're doubling down on it for the second block to really lock in those concepts. `;
        } else {
            reasoning += `Followed by ${secondary.name} to keep your progress nice and even. `;
        }
    }

    if (selected.length > 2) {
        const tertiary = selected[2];
        if (tertiary.id === primary.id || tertiary.id === secondary?.id) {
            reasoning += `Wrapping up with a quick 25m sprint to review everything.`;
        } else {
            reasoning += `Finally, a quick 25m sprint on ${tertiary.name} just to keep the rust off.`;
        }
    }

    return {
        blocks,
        risk,
        reasoning,
        startNow: `Start the first ${blocks[0].minutes}m block (${blocks[0].subject})`,
        meta: { source: 'deterministic' },
    };
}

function buildTask(s: SubjectScore): string {
    if (s.stuckRate > 0.3 && s.topTopics.length > 0) {
        return `Active recall on stuck topic(s): ${s.topTopics.join(', ')}`;
    }
    if (s.topTopics.length > 0) {
        return `Continue work on: ${s.topTopics.join(', ')}`;
    }
    return `Review notes and solve 1 practice problem`;
}

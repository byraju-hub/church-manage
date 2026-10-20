// 출석부는 별도 시스템이라 교적에는 출석 기록이 없습니다.
// 대시보드의 출석 현황을 시험해 보기 위한 가상 출석 샘플입니다. (실제 연동 시 출석부 조회로 교체)

import { generated } from './seed.ts';

// 최근 연속으로 결석 중인 사람: 사람 id → 최근 몇 주 연속 결석인지
export const ABSENT_STREAK: Record<string, number> = { p10: 6, p12: 3, ...generated.absentStreak };
// 사람별 평소 출석률 (없으면 0.82)
const RATE: Record<string, number> = { p1: 0.95, p2: 0.95, p3: 0.8, p4: 0.9, p5: 0.9, p6: 0.85, p7: 0.7, p9: 0.9, p13: 0.75, ...generated.attendRate };

function hash(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return (h >>> 0) % 1000;
}

const iso = (d: Date) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 오늘 이전의 가장 가까운 주일부터 거꾸로 n주 (오래된 순)
export function recentSundays(n = 8, today = new Date()): string[] {
	const last = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	last.setDate(last.getDate() - last.getDay());
	const out: string[] = [];
	for (let i = n - 1; i >= 0; i--) {
		const d = new Date(last);
		d.setDate(last.getDate() - i * 7);
		out.push(iso(d));
	}
	return out;
}

// weeksFromEnd: 0 = 가장 최근 주일
export function wasPresent(personId: string, sundayIso: string, weeksFromEnd: number): boolean {
	if ((ABSENT_STREAK[personId] ?? 0) > weeksFromEnd) return false;
	return hash(personId + sundayIso) / 1000 < (RATE[personId] ?? 0.82);
}

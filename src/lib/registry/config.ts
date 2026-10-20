// 조직 구성 같은 '설정' 성격의 자료. 실제로는 관리자 화면에서 바꾸는 값입니다.
import type { Category, OrgUnit } from './types.ts';

// ---- 교인구분 (3단계) : '교적 프로그램 구조' 문서 ----
//   교인 / 미등록·타교인  >  장년 / 청년 / 교육부서 / 새가족  >  예배출석 / 가끔출석 / 불출석
//   별세 · 이사/이민 · 보관 은 1단계로 끝남
const L1: [string, string][] = [['m', '교인'], ['o', '미등록/타교인']];
const L2: [string, string][] = [['a', '장년'], ['y', '청년'], ['e', '교육부서'], ['n', '새가족']];
const L3: [string, string][] = [['a', '예배출석'], ['s', '가끔출석'], ['n', '불출석']];

export const CATEGORIES: Category[] = (() => {
	const out: Category[] = [];
	L1.forEach(([k1, n1], i) => {
		out.push({ id: k1, parent_id: null, name: n1, sort_order: i + 1 });
		L2.forEach(([k2, n2], j) => {
			out.push({ id: `${k1}.${k2}`, parent_id: k1, name: n2, sort_order: j + 1 });
			L3.forEach(([k3, n3], k) => out.push({ id: `${k1}.${k2}.${k3}`, parent_id: `${k1}.${k2}`, name: n3, sort_order: k + 1 }));
		});
	});
	out.push({ id: 'dead', parent_id: null, name: '별세', sort_order: 3 });
	out.push({ id: 'move', parent_id: null, name: '이사/이민', sort_order: 4 });
	out.push({ id: 'keep', parent_id: null, name: '보관', sort_order: 5 });
	return out;
})();
export const catId = (l1: 'm' | 'o', l2: 'a' | 'y' | 'e' | 'n', l3: 'a' | 's' | 'n') => `${l1}.${l2}.${l3}`;

// ---- 공동체·소그룹 (2026년 편성표 구조: 공동체 3개, 소그룹 27개 + 로뎀나무숲) ----
export interface GroupDef { name: string; size: number; place: string; care?: boolean }
export interface CommunityDef { name: string; born: string; from: number; to: number; groups: GroupDef[] }
const G = (name: string, size: number, place: string, care = false): GroupDef => ({ name, size, place, care });

export const COMMUNITY_DEFS: CommunityDef[] = [
	{
		name: '뿌리 공동체', born: '55년 이전 출생', from: 1900, to: 1955,
		groups: [
			G('나눔의향기', 20, '다니엘관 101호'), G('브니엘', 18, '다니엘관 201호'), G('만나', 23, '다니엘관 306호'), G('루디아', 24, '휴게실'),
			G('해피', 18, '새가족부실'), G('화평', 20, '챔버실'), G('온유', 25, '카페'), G('사랑', 31, '찬양대실')
		]
	},
	{
		name: '줄기 공동체', born: '56~70년 출생', from: 1956, to: 1970,
		groups: [
			G('헵시바', 15, '다니엘관 204호'), G('엎드림', 13, '본관 301호'), G('바라크', 11, '다니엘관 302호'), G('임마누엘', 12, '다니엘관 205호'),
			G('우리가', 14, '다니엘관 206호'), G('미션', 19, '다니엘관 303호'), G('햇살통로', 21, '본관 2층 자모실'), G('시나브로', 19, '다니엘관 304호'),
			G('라온', 16, '다니엘관 207호'), G('톱니바퀴', 18, '다니엘관 307호'), G('은혜', 17, '유초등부실')
		]
	},
	{
		name: '열매 공동체', born: '71년 이후 출생', from: 1971, to: 2100,
		groups: [
			G('훈남', 26, '다니엘관 203호'), G('광야', 25, '본관 B01'), G('누림', 14, '다니엘관 301호'), G('위러브', 15, '다니엘관 208호'),
			G('기경', 16, '본관 302호'), G('푸풀', 16, '다니엘관 305호'), G('샬롬', 15, '다니엘관 202호'), G('디비디비딥', 16, '본당'),
			G('로뎀나무숲', 24, '자녀 돌봄', true)
		]
	}
];

// ---- 교회 조직표 (위원회 / 실무부서) : 2026년도 교회조직표의 구조. 담당자는 가상 인물 ----
const COMMITTEES: [string, string[]][] = [
	['공동체위원회', ['열매공동체', '줄기공동체', '뿌리공동체', '로뎀나무숲']],
	['교육위원회', ['영아부', '유치부', '유초등부', '중고등부', '새가족부', '청년부']],
	['기획위원회', ['사역기획부', '장학부', '조직관리부']],
	['관리위원회', ['시설관리부']],
	['봉사위원회', ['주차봉사부', '차량관리부', '식당봉사부', '수양관관리부', '환경미화부']],
	['미디어위원회', ['방송부', '카페봉사부', '콘텐츠제작부']],
	['예배위원회', ['예배부', '할렐루야찬양대', '시온찬양대', '그레이스찬양대', '아가페찬양대', '셀라 챔버', '찬양단']],
	['선교위원회', ['국내선교부', '국외선교부', '지역전도부', '전도폭발부']],
	['재정위원회', ['수집부', '계수부', '수지부']]
];
export const ORG_UNITS: OrgUnit[] = (() => {
	const out: OrgUnit[] = [];
	COMMITTEES.forEach(([c, ds], i) => {
		out.push({ id: `ou${i + 1}`, parent_id: null, name: c, sort_order: i + 1, leader_id: null });
		ds.forEach((d, j) => out.push({ id: `ou${i + 1}-${j + 1}`, parent_id: `ou${i + 1}`, name: d, sort_order: j + 1, leader_id: null }));
	});
	return out;
})();

import type { Family, Group, Member, Visit } from '../types';

export const groups: Group[] = [
	{ id: 'g1', name: '1구역', leader_member_id: 'm3' },
	{ id: 'g2', name: '2구역', leader_member_id: 'm7' },
	{ id: 'g3', name: '3구역', leader_member_id: null }
];

export const families: Family[] = [
	{ id: 'f1', name: '김철수 가정', address: '서울시 강동구 천호동 123' },
	{ id: 'f2', name: '이영희 가정', address: '서울시 송파구 잠실동 45' },
	{ id: 'f3', name: '박민준 가정', address: '서울시 강동구 길동 78' }
];

const base: Member = {
	id: '', name: '', gender: null, birth_date: null, phone: null, email: null, address: null,
	family_id: null, family_relation: null, group_id: null, status: 'active', position: '성도',
	registered_at: null, baptism_type: 'none', baptism_date: null, previous_church: null, memo: null
};
const m = (o: Partial<Member>): Member => ({ ...base, ...o });

export const members: Member[] = [
	m({ id: 'm1', name: '김철수', gender: 'M', birth_date: '1970-03-12', phone: '010-1111-2222', family_id: 'f1', family_relation: '세대주', group_id: 'g1', position: '장로', registered_at: '2005-04-03', baptism_type: 'adult', baptism_date: '2005-06-12', address: '서울시 강동구 천호동 123' }),
	m({ id: 'm2', name: '정미경', gender: 'F', birth_date: '1973-08-21', phone: '010-1111-3333', family_id: 'f1', family_relation: '배우자', group_id: 'g1', position: '권사', registered_at: '2005-04-03', baptism_type: 'adult', baptism_date: '2004-12-25' }),
	m({ id: 'm3', name: '김하늘', gender: 'F', birth_date: '1998-01-30', phone: '010-1111-4444', family_id: 'f1', family_relation: '자녀', group_id: 'g1', position: '성도', registered_at: '2005-04-03', baptism_type: 'infant', baptism_date: '1998-05-10', memo: '청년부 회장' }),
	m({ id: 'm4', name: '이영희', gender: 'F', birth_date: '1965-11-02', phone: '010-2222-1111', family_id: 'f2', family_relation: '세대주', group_id: 'g2', position: '권사', registered_at: '1998-09-13', baptism_type: 'adult', baptism_date: '1998-12-20' }),
	m({ id: 'm5', name: '최동현', gender: 'M', birth_date: '1962-05-18', phone: '010-2222-2222', family_id: 'f2', family_relation: '배우자', group_id: 'g2', position: '안수집사', registered_at: '1998-09-13', baptism_type: 'adult', baptism_date: '1999-03-28' }),
	m({ id: 'm6', name: '박민준', gender: 'M', birth_date: '1985-07-07', phone: '010-3333-1111', family_id: 'f3', family_relation: '세대주', group_id: 'g2', position: '집사', registered_at: '2015-02-01', baptism_type: 'adult', baptism_date: '2015-05-05' }),
	m({ id: 'm7', name: '한지은', gender: 'F', birth_date: '1987-09-14', phone: '010-3333-2222', family_id: 'f3', family_relation: '배우자', group_id: 'g2', position: '집사', registered_at: '2015-02-01', baptism_type: 'adult', baptism_date: '2013-10-06' }),
	m({ id: 'm8', name: '박서윤', gender: 'F', birth_date: '2016-04-25', family_id: 'f3', family_relation: '자녀', group_id: 'g2', registered_at: '2016-06-05', baptism_type: 'infant', baptism_date: '2016-12-04' }),
	m({ id: 'm9', name: '오성민', gender: 'M', birth_date: '1991-12-03', phone: '010-4444-5555', status: 'newcomer', group_id: 'g3', position: null, registered_at: '2026-09-27', previous_church: '새빛교회', memo: '직장 동료 소개로 방문' }),
	m({ id: 'm10', name: '윤재석', gender: 'M', birth_date: '1958-02-09', phone: '010-5555-6666', status: 'inactive', group_id: 'g3', position: '집사', registered_at: '2002-03-10', baptism_type: 'adult', memo: '건강 문제로 2년째 결석' }),
	m({ id: 'm11', name: '강수진', gender: 'F', birth_date: '1980-06-30', phone: '010-6666-7777', status: 'transferred', position: '집사', registered_at: '2010-01-17', baptism_type: 'adult', memo: '2026년 부산 지역으로 이명' })
];

export const visits: Visit[] = [
	{ id: 'v1', member_id: 'm10', visit_date: '2026-09-15', visit_type: '정기심방', visited_by: '담임목사', content: '건강 상태 확인, 회복을 위해 기도함.' },
	{ id: 'v2', member_id: 'm9', visit_date: '2026-10-04', visit_type: '새가족심방', visited_by: '부목사', content: '교회 소개 및 새가족반 안내.' }
];

import { http, HttpResponse } from 'msw';
import { baseUrl, testUser } from './auth-fixtures';

export const goalRow = {
  id: '22222222-2222-4222-8222-222222222222',
  user_id: testUser.id,
  name: '할 일',
  color: '#4F7CFF',
  sort_key: 'a0',
  archived_at: null,
  deleted_at: null,
  created_at: '2026-09-17T00:00:00Z',
  updated_at: '2026-09-17T00:00:00Z',
};
export const todoRow = {
  id: '33333333-3333-4333-8333-333333333333',
  user_id: testUser.id,
  goal_id: goalRow.id,
  title: '책 읽기',
  date: '2026-09-30',
  is_done: false,
  done_at: null,
  sort_key: 'a0',
  deleted_at: null,
  created_at: '2026-09-17T00:00:00Z',
  updated_at: '2026-09-17T00:00:00Z',
};
export const dataHandlers = [
  http.get(`${baseUrl}/rest/v1/goals`, () => HttpResponse.json([goalRow])),
  http.get(`${baseUrl}/rest/v1/todos`, () => HttpResponse.json([])),
  http.get(`${baseUrl}/rest/v1/routines`, () => HttpResponse.json([])),
  http.get(`${baseUrl}/rest/v1/routine_logs`, () => HttpResponse.json([])),
];

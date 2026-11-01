import test from 'node:test';
import assert from 'node:assert/strict';
import { customDateRangeError } from '../src/dashboard/shared/dates.js';

test('partial and cleared date edits cannot become an applied range', () => {
  for (const value of ['', '2026-', '2026-10-', '2026-1-02', 'not-a-date', '12026-10-02']) {
    assert.ok(customDateRangeError(value, '2026-11-01'), value);
    assert.ok(customDateRangeError('2026-10-02', value), value);
  }
});

test('invalid calendar dates and reversed ranges are rejected', () => {
  assert.ok(customDateRangeError('2026-02-29', '2026-11-01'));
  assert.ok(customDateRangeError('2026-10-02', '2026-11-31'));
  assert.ok(customDateRangeError('2026-11-02', '2026-11-01'));
});

test('complete ranges include same-day, leap-day and year boundaries', () => {
  for (const [from, to] of [
    ['2026-10-02', '2026-11-01'],
    ['2026-11-01', '2026-11-01'],
    ['2024-02-29', '2024-03-01'],
    ['2025-12-31', '2026-01-01'],
  ]) assert.equal(customDateRangeError(from, to), '');
});

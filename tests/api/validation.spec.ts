import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../../src/server/api-errors';
import { parsePagination, requireObjectId } from '../../src/server/validation';
import { validateCourseInput } from '../../src/server/domain-api';

test('pagination applies defaults and caps page size', () => {
  assert.deepEqual(parsePagination(undefined, undefined), { page: 1, limit: 20, skip: 0 });
  assert.deepEqual(parsePagination('3', '500'), { page: 3, limit: 100, skip: 200 });
});

test('pagination rejects malformed and non-positive values', () => {
  for (const value of ['0', '-1', '1.2', '1abc', '']) {
    assert.throws(() => parsePagination(value, undefined), ApiError);
  }
});

test('object identifiers are validated before database access', () => {
  assert.equal(requireObjectId('64f1a2b3c4d5e6f708091011'), '64f1a2b3c4d5e6f708091011');
  assert.throws(() => requireObjectId('not-an-id', 'course ID'), ApiError);
});

test('course creation accepts bounded valid curriculum data', () => {
  assert.deepEqual(validateCourseInput({
    title: 'JavaScript for Builders',
    description: 'A practical course for learning modern JavaScript with real projects.',
    category: 'Development',
    level: 'Beginner',
    duration: '8 hours',
    modules: [{
      title: 'Language foundations',
      lessons: 3,
      duration: '2 hours',
      topics: ['Values and types', 'Functions and scope'],
    }],
  }), {
    title: 'JavaScript for Builders',
    description: 'A practical course for learning modern JavaScript with real projects.',
    category: 'Development',
    level: 'Beginner',
    duration: '8 hours',
    modules: [{
      title: 'Language foundations',
      lessons: 3,
      duration: '2 hours',
      topics: ['Values and types', 'Functions and scope'],
    }],
    lessonCount: 3,
  });
});

test('course creation rejects excessive and incomplete curricula', () => {
  assert.throws(() => validateCourseInput({
    title: 'JavaScript for Builders',
    description: 'A practical course for learning modern JavaScript with real projects.',
    category: 'Development',
    level: 'Beginner',
    duration: '8 hours',
    modules: [],
  }), ApiError);

  assert.throws(() => validateCourseInput({
    title: 'JavaScript for Builders',
    description: 'A practical course for learning modern JavaScript with real projects.',
    category: 'Development',
    level: 'Beginner',
    duration: '8 hours',
    modules: [{
      title: 'Language foundations',
      lessons: 1001,
      duration: '2 hours',
      topics: [],
    }],
  }), ApiError);
});

test('course curriculum rejects module topic values outside the schema', () => {
  assert.throws(() => validateCourseInput({
    title: 'JavaScript for Builders',
    description: 'A practical course for learning modern JavaScript with real projects.',
    category: 'Development',
    level: 'Beginner',
    duration: '8 hours',
    modules: [{
      title: 'Language foundations',
      lessons: 3,
      duration: '2 hours',
      topics: ['x'],
    }],
  }), ApiError);
});

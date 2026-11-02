import { expect, test } from 'bun:test';
import { refuseOfflineWorker, blockOfflineRefresh } from '../src/lib/offline-policy';
test('offline caching is forbidden in editor and draft previews', () => {
  for (const host of ['id-preview--abc.lovable.app', 'preview-v2--abc.lovable.app', 'project--abc-dev.lovable.app', 'a.lovableproject.com', 'beta.lovable.dev']) expect(refuseOfflineWorker(true, false, host, false)).toBe(true);
});
test('published domains support offline caching', () => {
  expect(refuseOfflineWorker(true, false, 'medilife.cloud', false)).toBe(false);
  expect(refuseOfflineWorker(true, false, 'medilifeuz.lovable.app', false)).toBe(false);
  expect(refuseOfflineWorker(true, false, 'preview-v2--shop.example.com', false)).toBe(false);
});
test('development, iframe and kill switch refuse registration', () => {
  expect(refuseOfflineWorker(false, false, 'medilife.cloud', false)).toBe(true);
  expect(refuseOfflineWorker(true, true, 'medilife.cloud', false)).toBe(true);
  expect(refuseOfflineWorker(true, false, 'medilife.cloud', true)).toBe(true);
});
test('offline refresh shortcut prevention covers Ctrl R, Cmd R and F5 only', () => {
  expect(blockOfflineRefresh('r', 'KeyR', true, false)).toBe(true);
  expect(blockOfflineRefresh('R', 'KeyR', false, true)).toBe(true);
  expect(blockOfflineRefresh('F5', 'F5', false, false)).toBe(true);
  expect(blockOfflineRefresh('r', 'KeyR', false, false)).toBe(false);
});
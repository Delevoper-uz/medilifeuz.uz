import { expect, test } from 'bun:test';
import { requestMetadata, VisitSchema } from '../src/lib/request-metadata';

test('order IP comes from the trusted edge, not arbitrary forwarded headers', () => {
  const headers = new Headers({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '192.0.2.9' });
  expect(requestMetadata(headers, true).ip_address).toBe('203.0.113.7');
  expect(requestMetadata(headers, false).ip_address).toBeNull();
  expect(requestMetadata(new Headers({ 'x-forwarded-for': '192.0.2.9' }), true).ip_address).toBeNull();
});
test('device and browser are identified without asking the visitor', () => {
  const headers = new Headers({ 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const result = requestMetadata(headers, false);
  expect(result.device).toBe('Telefon · Apple iPhone');
  expect(result.browser).toBe('Mobile Safari 17.0');
  expect(result.os).toBe('iOS 17.0');
});
test('invalid IP and worker subrequest attribution remain unknown', () => {
  expect(requestMetadata(new Headers({ 'cf-connecting-ip': 'bad' }), true).ip_address).toBeNull();
  expect(requestMetadata(new Headers({ 'cf-connecting-ip': '203.0.113.7', 'cf-worker': 'example.com' }), true).ip_address).toBeNull();
});
test('visit paths cannot contain personal query strings', () => {
  expect(VisitSchema.safeParse({ path: '/dorilar' }).success).toBe(true);
  expect(VisitSchema.safeParse({ path: '/login?token=secret' }).success).toBe(false);
});
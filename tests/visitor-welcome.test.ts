import { expect, test } from 'bun:test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseTest = url && key ? test : test.skip;

databaseTest('each new IP receives one welcome, including concurrent requests and reloads', async () => {
  if (!url || !key) throw new Error('Missing test configuration');
  const client = createClient(url, key, { auth: { persistSession: false } });
  // Reserved benchmarking range; no actual visitor address is used.
  const bytes = crypto.getRandomValues(new Uint8Array(2));
  const ip = `198.18.${bytes[0]}.${bytes[1]}`;
  const existing = await client.from('visitor_welcome_ips').select('ip_address').eq('ip_address', ip);
  expect(existing.error).toBeNull();
  expect(existing.data).toHaveLength(0);
  try {
    const first = await client.rpc('claim_visitor_welcome', { p_ip: ip });
    expect(first.error).toBeNull();
    expect(first.data).toBe(true);
    const repeats = await Promise.all(Array.from({ length: 8 }, () => client.rpc('claim_visitor_welcome', { p_ip: ip })));
    for (const result of repeats) {
      expect(result.error).toBeNull();
      expect(result.data).toBe(false);
    }
    const reload = await client.rpc('claim_visitor_welcome', { p_ip: ip });
    expect(reload.data).toBe(false);
  } finally {
    const removed = await client.from('visitor_welcome_ips').delete().eq('ip_address', ip);
    expect(removed.error).toBeNull();
  }
});

databaseTest('simultaneous first visits from a different new IP claim exactly one welcome', async () => {
  if (!url || !key) throw new Error('Missing test configuration');
  const client = createClient(url, key, { auth: { persistSession: false } });
  const bytes = crypto.getRandomValues(new Uint8Array(2));
  const ip = `198.19.${bytes[0]}.${bytes[1]}`;
  const existing = await client.from('visitor_welcome_ips').select('ip_address').eq('ip_address', ip);
  expect(existing.error).toBeNull();
  expect(existing.data).toHaveLength(0);
  try {
    const results = await Promise.all(Array.from({ length: 8 }, () => client.rpc('claim_visitor_welcome', { p_ip: ip })));
    for (const result of results) expect(result.error).toBeNull();
    expect(results.filter(result => result.data === true)).toHaveLength(1);
  } finally {
    const removed = await client.from('visitor_welcome_ips').delete().eq('ip_address', ip);
    expect(removed.error).toBeNull();
  }
});
import { expect, test } from 'bun:test';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import { handleOperatorUpdate } from '../src/lib/operator.server';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const group = process.env.TELEGRAM_CHAT_ID;
test.skipIf(!url || !key || !group)('Telegram operator callback sequence updates only its request and produces send controls', async () => {
  if (!url || !key || !group) return;
  const original = globalThis.fetch;
  const messages: any[] = [];
  let sequence = Math.floor(Date.now() * 100 + Math.random() * 90);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith('https://api.telegram.org/')) {
      messages.push(JSON.parse(String(init?.body ?? '{}')));
      return Response.json({ ok: true, result: { message_id: sequence++ } });
    }
    return original(input, init);
  }) as typeof fetch;
  const db = createClient(url, key, { auth: { persistSession: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith('sb_')) headers.delete('Authorization');
    headers.set('apikey', key);
    return original(input, { ...init, headers });
  } } });
  const id = randomUUID();
  const operator = 123456789;
  let update = -Math.floor(Date.now() / 10);
  const callback = async (action: string, user = operator) => handleOperatorUpdate({ update_id: update--, callback_query: { id: randomUUID(), data: `op:${action}:${id}`, from: { id: user }, message: { message_id: 1, chat: { id: Number(group) } } } }, 'test-mocked-token');
  const read = async () => (await db.from('operator_requests').select('*').eq('id', id).single()).data;
  try {
    const inserted = await db.from('operator_requests').insert({ id, secret_hash: createHash('sha256').update(randomUUID()).digest('hex'), chat_id: Number(group), message_id: 1 });
    expect(inserted.error).toBeNull();
    await callback('claim');
    expect((await read()).operator_id).toBe(operator);
    await callback('add', operator + 1);
    expect((await read()).operator_id).toBe(operator);
    await callback('add');
    expect((await read()).step).toBe('search');
    const medicines = [{ id: randomUUID(), name: 'Ekvator', price: 10000 }, { id: randomUUID(), name: 'Telsartan A', price: 20000 }];
    expect((await db.rpc('operator_request_action', { p_id: id, p_operator: operator, p_action: 'candidates', p_value: medicines })).error).toBeNull();
    const row = await read();
    const reply = async (number: string) => handleOperatorUpdate({ update_id: update--, message: { message_id: sequence++, chat: { id: Number(group) }, from: { id: operator }, reply_to_message: { message_id: (await read()).prompt_id || row.prompt_id }, text: number } }, 'test-mocked-token');
    await reply('1');
    expect((await read()).selected[0].name).toBe('Ekvator');
    await callback('remove');
    await reply('1');
    expect((await read()).selected).toHaveLength(0);
    await callback('undo');
    expect((await read()).selected[0].name).toBe('Ekvator');
    await callback('preview');
    expect(messages.some(m => m.reply_markup?.inline_keyboard?.flat().some((b: any) => b.callback_data === `op:send:${id}`))).toBe(true);
    await callback('send');
    expect((await read()).status).toBe('sent');
    expect((await read()).selected).toHaveLength(1);
  } finally {
    globalThis.fetch = original;
    await db.from('operator_requests').delete().eq('id', id);
  }
}, 30000);
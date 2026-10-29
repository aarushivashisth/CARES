import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from '../config/env.js';

// Only translates the small, audited SQLite syntax used by existing route queries.
// Quoted literals are preserved when converting placeholders.
export function postgresSql(sql) {
  let result = sql.replace(/datetime\(created_at, '\+30 seconds'\)/g, "(created_at::timestamp + interval '30 seconds')::text")
    .replace(/datetime\('now'\)/g, "(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::text")
    .replace(/date\('now'\)/g, "CURRENT_DATE::text");
  let index = 0;
  result = result.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g, part => part === '?' ? `$${++index}` : part);
  return result;
}

export function createPostgresDb(pool) {
  function access(client) {
    return {
      async all(sql, params = []) { return (await client.query(postgresSql(sql), params)).rows; },
      async get(sql, params = []) { return (await this.all(sql, params))[0]; },
      async run(sql, params = []) {
        let query = postgresSql(sql).trim().replace(/;$/, '');
        if (/^INSERT\s+INTO/i.test(query) && !/\bRETURNING\b/i.test(query)) query += ' RETURNING id';
        const result = await client.query(query, params);
        return { changes: result.rowCount ?? result.affectedRows ?? result.rows.length, lastInsertRowid: result.rows?.[0]?.id };
      },
      async exec(sql) { return client.query(postgresSql(sql)); },
    };
  }
  const adapter = access(pool);
  adapter.transaction = async callback => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // All state transitions take locks in a consistent order. Prevent stale-read
      // races between patient cancellation and provider acceptance/completion.
      await client.query('LOCK TABLE appointment_requests IN SHARE ROW EXCLUSIVE MODE');
      const value = await callback(access(client));
      await client.query('COMMIT');
      return value;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally { client.release(); }
  };
  adapter.close = () => pool.end();
  return adapter;
}

let selected;
const scope = new AsyncLocalStorage();
let queue = Promise.resolve();
function exclusive(fn) {
  const pending = queue.then(fn, fn);
  queue = pending.catch(() => {});
  return pending;
}
async function database() {
  if (selected) return selected;
  if (config.databaseUrl) {
    const { Pool } = await import('pg');
    selected = createPostgresDb(new Pool({ connectionString: config.databaseUrl, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000, statement_timeout: 5000, query_timeout: 7000, allowExitOnIdle: true }));
  } else {
    const { db: sqlite } = await import('./connection.js');
    selected = Object.fromEntries(['get','all','run','exec'].map(method => [method, (...args) => {
      if (scope.getStore()) return sqlite[method](...args);
      return exclusive(() => sqlite[method](...args));
    }]));
    selected.transaction = callback => exclusive(() => scope.run(true, async () => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { const value = await callback(selected); sqlite.exec('COMMIT'); return value; }
      catch (err) { sqlite.exec('ROLLBACK'); throw err; }
    }));
    selected.close = () => sqlite.close();
  }
  return selected;
}
// Cache initialization itself, so concurrent cold-start requests use one pool.
let initialization;
export function configureTestDatabase(adapter) {
  if (config.nodeEnv !== 'test' || initialization) throw new Error('Test database injection only before test initialization.');
  selected=adapter;
}
export const db = Object.fromEntries(['get','all','run','exec','transaction','close'].map(method => [method, async (...args) => {
  initialization ||= database();
  return (await initialization)[method](...args);
}]));

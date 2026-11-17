'use strict';
/** Local dev server for Code.gs: node google-apps-script/dev/server.cjs [port=8787] */
const http = require('node:http');
const { createGasContext } = require('./gas-sim.cjs');

const port = Number(process.argv[2] || process.env.PORT || 8787);
const ownerEmail = process.env.OWNER_EMAIL || 'owner@example.com';
const g = createGasContext({ ownerEmail, printErrors: true });
g.runSetup();
let seeded = false;

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, Object.assign({ 'Content-Type': type + '; charset=utf-8' }, CORS));
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve, reject) => {
  let d = '';
  req.on('data', (c) => { d += c; if (d.length > 2e6) { reject(new Error('too large')); req.destroy(); } });
  req.on('end', () => resolve(d));
  req.on('error', reject);
});

function codeFor(email) {
  const m = [...g.outbox].reverse().find((x) => x.to === email && /\d{6}/.test(x.subject));
  return m && m.subject.match(/\d{6}/)[0];
}
function must(r, what) {
  if (!r.ok) throw new Error(`seed failed at ${what}: ${r.error}`);
  return r.data;
}
function signIn(email, purpose) {
  must(g.call('sendCode', { email, purpose }), 'sendCode');
  return must(g.call('verifyCode', { email, purpose, code: codeFor(email) }), 'verifyCode').token;
}

function seed() {
  const ctx = g.context;
  const day = (n) => ctx.addDays_(ctx.today_(), n);
  const a = signIn(ownerEmail, 'admin');
  const sent = g.outbox.length;

  // Customers: approved (admin-added), pending (self-requested), rejected, blocked.
  must(g.call('customerAdd', { token: a, email: 'priya.sharma@example.com', name: 'Priya Sharma', mobile: '9840011223' }), 'customerAdd');
  must(g.call('customerAdd', { token: a, email: 'ravi.kumar@example.com', name: 'Ravi Kumar', mobile: '9841122334' }), 'customerAdd');
  const pend = signIn('meena.iyer@example.com', 'customer');
  must(g.call('requestAccess', { token: pend, name: 'Meena Iyer', mobile: '9842233445' }), 'requestAccess');
  for (const [email, name, status] of [['spam.user@example.com', 'Spam User', 'rejected'], ['bad.actor@example.com', 'Bad Actor', 'blocked']]) {
    must(g.call('customerAdd', { token: a, email, name, mobile: '9000000000' }), 'customerAdd');
    must(g.call('customerDecide', { token: a, email, status, note: 'Seed data' }), 'customerDecide');
  }

  const mk = (over, status) => must(g.call('bookingCreate', Object.assign({ token: a, status, slot: 'fullday', eventType: 'wedding', guests: 250 }, over)), 'bookingCreate');
  const upd = (id, changes) => must(g.call('bookingUpdate', { token: a, id, changes }), 'bookingUpdate');

  const b1 = mk({ date: day(-40), name: 'Priya Sharma', email: 'priya.sharma@example.com', mobile: '9840011223', amount: 180000 }, 'confirmed');
  const b2 = mk({ date: day(-12), name: 'Ravi Kumar', email: 'ravi.kumar@example.com', mobile: '9841122334', eventType: 'reception', slot: 'evening', guests: 400, amount: 120000 }, 'confirmed');
  const b3 = mk({ date: day(9), name: 'Anitha Rajan', mobile: '9843344556', guests: 500, amount: 250000 }, 'confirmed');
  mk({ date: day(23), name: 'Kiran Patel', mobile: '9844455667', eventType: 'birthday', slot: 'night', guests: 80, amount: 35000 }, 'confirmed');
  mk({ date: day(15), name: 'Suresh Babu', mobile: '9845566778', eventType: 'corporate', slot: 'morning', guests: 60 }, 'pending');
  mk({ date: day(30), name: 'Lakshmi Narayanan', mobile: '9846677889', eventType: 'anniversary', slot: 'evening', guests: 120 }, 'pending');
  const r1 = mk({ date: day(5), name: 'Rejected Rahul', mobile: '9847788990', eventType: 'other', guests: 40 }, 'pending');
  upd(r1.id, { status: 'rejected' });
  const c1 = mk({ date: day(45), name: 'Cancelled Chitra', email: 'chitra@example.com', mobile: '9848899001', guests: 150 }, 'confirmed');
  upd(c1.id, { status: 'cancelled' });

  const money = [
    ['income', 'Booking payment', 90000, -41, b1.id, 'Advance — Priya Sharma'],
    ['income', 'Booking payment', 90000, -33, b1.id, 'Balance — Priya Sharma'],
    ['income', 'Catering commission', 22000, -39, '', 'Caterer commission, Sharma wedding'],
    ['income', 'Booking payment', 60000, -20, b2.id, 'Advance — Ravi Kumar reception'],
    ['income', 'Booking payment', 60000, -11, b2.id, 'Balance — Ravi Kumar reception'],
    ['income', 'Booking payment', 100000, -3, b3.id, 'Advance — Anitha Rajan'],
    ['income', 'Other income', 5000, -25, '', 'Generator rental'],
    ['expense', 'Electricity (current) bill', 18400, -60, '', 'EB bill — September'],
    ['expense', 'Electricity (current) bill', 21250, -30, '', 'EB bill — October'],
    ['expense', 'Cleaning bill', 6500, -38, b1.id, 'Cleaning after Sharma wedding'],
    ['expense', 'Cleaning bill', 4800, -11, b2.id, 'Cleaning after Kumar reception'],
    ['expense', 'Other expense', 3200, -7, '', 'Garden maintenance'],
  ];
  money.forEach(([type, category, amount, off, bookingId, description]) =>
    must(g.call('moneyAdd', { token: a, type, category, amount, date: day(off), bookingId, description }), 'moneyAdd'));

  g.call('logout', { token: a });
  g.call('logout', { token: pend });
  return { customers: 6, bookings: 8, money: money.length, mailsSent: g.outbox.length - sent };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (url.pathname === '/exec' && req.method === 'POST') {
      const body = await readBody(req);
      let action = '?';
      try { action = JSON.parse(body).action; } catch (e) { /* bad json is handled by doPost */ }
      const out = g.rawPost(body);
      console.log(`POST /exec ${action} -> ${out.ok ? 'ok' : out.code || 'error'}`);
      return send(res, 200, out, 'text/plain');
    }
    if (url.pathname === '/exec' && req.method === 'GET') {
      const action = url.searchParams.get('action');
      const out = g.get(action || undefined);
      console.log(`GET  /exec ${action || 'status'} -> ${out.ok ? 'ok' : out.code || 'error'}`);
      return send(res, 200, out, 'text/plain');
    }
    if (url.pathname === '/dev/outbox' && req.method === 'GET') return send(res, 200, g.outbox.slice(-50));
    if (url.pathname === '/dev/seed' && req.method === 'POST') {
      if (seeded) return send(res, 409, { ok: false, error: 'Already seeded; restart the server to reset.' });
      const summary = seed();
      seeded = true;
      console.log('POST /dev/seed -> ok', JSON.stringify(summary));
      return send(res, 200, { ok: true, data: summary });
    }
    send(res, 404, { ok: false, error: 'Not found' });
  } catch (err) {
    console.error('request failed:', err && err.message);
    send(res, 500, { ok: false, error: String(err && err.message) });
  }
});

server.listen(port, () => console.log(`Park Inn dev backend on http://localhost:${port}/exec (owner: ${ownerEmail})`));

'use strict';
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createGasContext } = require('./gas-sim.cjs');

const T0 = Date.parse('2026-11-17T06:00:00Z'); // 11:30 IST, 2026-11-17
const OWNER = 'owner@example.com';
const MIN = 60000;
const FUTURE = ['2026-12-05', '2026-12-06', '2026-12-07', '2026-12-08', '2026-12-09'];

let g;
beforeEach(() => {
  g = createGasContext({ now: T0, ownerEmail: OWNER });
  g.runSetup();
});

function lastCode(email) {
  const m = [...g.outbox].reverse().find((x) => x.to === email && /\d{6}/.test(x.subject));
  assert.ok(m, 'no code mail for ' + email);
  return m.subject.match(/\d{6}/)[0];
}
function signIn(email, purpose) {
  const s = g.call('sendCode', { email, purpose });
  assert.equal(s.ok, true);
  const v = g.call('verifyCode', { email, purpose, code: lastCode(email) });
  assert.equal(v.ok, true, JSON.stringify(v));
  return v.data.token;
}
const adminToken = (email = OWNER) => signIn(email, 'admin');
const customerToken = (email) => signIn(email, 'customer');
const booking = (over = {}) => Object.assign({
  date: FUTURE[0], slot: 'evening', eventType: 'wedding', guests: 200, name: 'Asha Rao', mobile: '+919876543210', notes: '',
}, over);

function approvedCustomer(email = 'cust@example.com') {
  const a = adminToken();
  const c = customerToken(email);
  assert.equal(g.call('requestAccess', { token: c, name: 'Cust', mobile: '9876543210' }).ok, true);
  assert.equal(g.call('customerDecide', { token: a, email, status: 'approved' }).ok, true);
  return { a, c };
}
function addAdmin(email = 'staff@example.com') {
  const o = adminToken();
  assert.equal(g.call('adminAdd', { token: o, email, role: 'admin' }).ok, true);
  return { owner: o, staff: adminToken(email) };
}
const noServerErrors = () => assert.deepEqual(g.logs.filter((l) => l[0] === 'error'), []);

describe('setup / status', () => {
  test('status before setup is not configured', () => {
    const fresh = createGasContext({ now: T0, ownerEmail: OWNER });
    const r = fresh.get('status');
    assert.equal(r.ok, true);
    assert.equal(r.data.configured, false);
    assert.equal(fresh.call('adminData', {}).ok, false);
  });

  test('status after setup', () => {
    const r = g.get('status');
    assert.deepEqual(r.data, { version: 2, configured: true, bookingEnabled: true, venueName: 'Dhanlakshmi Park Inn' });
    assert.deepEqual(g.sheets.names().sort(), ['Activity', 'Admins', 'Bookings', 'Customers', 'Money', 'Settings']);
    assert.equal(g.sheets.dump('Bookings')[0][0], 'Booking ID');
    assert.equal(g.sheets.dump('Money')[0][3], 'Category');
    assert.ok(g.calendar.get());
    assert.equal(g.calendar.get().getName(), 'Park Inn Bookings');
    assert.deepEqual(g.sheets.dump('Admins')[1].slice(0, 3), [OWNER, 'super_admin', 'setup']);
    assert.equal(g.spreadsheet.timeZone, 'Asia/Kolkata');
  });

  test('setup twice keeps one trigger, one owner row, one calendar', () => {
    g.runSetup();
    assert.equal(g.triggers.filter((t) => t.getHandlerFunction() === 'syncCalendar').length, 1);
    assert.equal(g.triggers[0].minutes, 15);
    assert.equal(g.triggers.filter(t => t.getHandlerFunction() === 'monthlyReportJob').length, 1);
    assert.equal(g.sheets.dump('Admins').length, 2);
    assert.equal(g.calendar.all().length, 1);
  });

  test('onOpen adds the menu', () => {
    g.context.onOpen();
    assert.equal(g.menus[0].title, 'Park Inn');
    assert.equal(g.menus[0].items.length, 2);
  });

  test('doGet never accepts token-bearing actions', () => {
    const r = g.get('adminData');
    assert.equal(r.ok, true);
    assert.equal(r.data.configured, true);
    assert.equal(r.data.bookings, undefined);
    assert.equal(g.get('availability').ok, true);
    assert.deepEqual(g.get('availability').data, { dates: {} });
  });

  test('bad JSON and unknown action', () => {
    assert.equal(g.rawPost('{nope').error, 'Bad request');
    const r = g.call('doesNotExist');
    assert.equal(r.ok, false);
    assert.equal(r.code, 'INVALID');
  });
});

describe('customer sign-in', () => {
  test('send + verify returns token and profile', () => {
    g.call('sendCode', { email: 'Cust@Example.com', purpose: 'customer' });
    const code = lastCode('cust@example.com');
    assert.match(code, /^\d{6}$/);
    const v = g.call('verifyCode', { email: 'cust@example.com', purpose: 'customer', code });
    assert.equal(v.ok, true);
    assert.equal(v.data.profile.access, 'none');
    assert.equal(g.call('me', { token: v.data.token }).data.email, 'cust@example.com');
    // code is single-use
    assert.equal(g.call('verifyCode', { email: 'cust@example.com', purpose: 'customer', code }).code, 'CODE');
  });

  test('wrong code rejected', () => {
    g.call('sendCode', { email: 'c@example.com', purpose: 'customer' });
    const code = lastCode('c@example.com');
    const wrong = code === '000000' ? '111111' : '000000';
    const r = g.call('verifyCode', { email: 'c@example.com', purpose: 'customer', code: wrong });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'CODE');
    assert.equal(g.call('verifyCode', { email: 'c@example.com', purpose: 'customer', code }).ok, true);
  });

  test('more than 5 wrong attempts invalidates the code', () => {
    g.call('sendCode', { email: 'c@example.com', purpose: 'customer' });
    const code = lastCode('c@example.com');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) assert.match(g.call('verifyCode', { email: 'c@example.com', purpose: 'customer', code: wrong }).error, /not correct/);
    assert.match(g.call('verifyCode', { email: 'c@example.com', purpose: 'customer', code: wrong }).error, /Too many wrong/);
    // even the right code no longer works
    const r = g.call('verifyCode', { email: 'c@example.com', purpose: 'customer', code });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'CODE');
  });

  test('code expires after 10 minutes', () => {
    g.call('sendCode', { email: 'c@example.com', purpose: 'customer' });
    const code = lastCode('c@example.com');
    g.clock.advance(10 * MIN + 1000);
    assert.equal(g.call('verifyCode', { email: 'c@example.com', purpose: 'customer', code }).code, 'CODE');
  });

  test('code still valid just before 10 minutes', () => {
    g.call('sendCode', { email: 'c@example.com', purpose: 'customer' });
    const code = lastCode('c@example.com');
    g.clock.advance(9 * MIN);
    assert.equal(g.call('verifyCode', { email: 'c@example.com', purpose: 'customer', code }).ok, true);
  });

  test('max 3 codes per 15 minutes per email', () => {
    for (let i = 0; i < 3; i++) assert.equal(g.call('sendCode', { email: 'c@example.com', purpose: 'customer' }).ok, true);
    const r = g.call('sendCode', { email: 'c@example.com', purpose: 'customer' });
    assert.equal(r.code, 'RATE_LIMIT');
    assert.equal(g.outbox.length, 3);
    g.clock.advance(15 * MIN + 1000);
    assert.equal(g.call('sendCode', { email: 'c@example.com', purpose: 'customer' }).ok, true);
  });

  test('invalid email rejected; mail failure surfaces as MAIL', () => {
    assert.equal(g.call('sendCode', { email: 'nope', purpose: 'customer' }).ok, false);
    g.mail.failNext = true;
    assert.equal(g.call('sendCode', { email: 'c@example.com', purpose: 'customer' }).code, 'MAIL');
  });

  test('tampered and expired tokens rejected (AUTH)', () => {
    const t = customerToken('c@example.com');
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ t: 'a', e: OWNER, sid: 'x', exp: T0 + 1e9 })).toString('base64url') + '.' + sig;
    assert.equal(g.call('me', { token: forged }).code, 'AUTH');
    assert.equal(g.call('me', { token: body + '.' + sig.slice(0, -2) + 'AA' }).code, 'AUTH');
    assert.equal(g.call('me', { token: 'garbage' }).code, 'AUTH');
    assert.equal(g.call('me', {}).code, 'AUTH');
    // customer token cannot reach admin routes
    assert.equal(g.call('adminData', { token: t }).code, 'AUTH');
    g.clock.advance(31 * 86400000);
    assert.equal(g.call('me', { token: t }).code, 'AUTH');
  });
});

describe('admin sign-in', () => {
  test('non-admin gets ok but no mail', () => {
    const r = g.call('sendCode', { email: 'stranger@example.com', purpose: 'admin' });
    assert.deepEqual(r, { ok: true, data: { sent: true } });
    assert.equal(g.outbox.length, 0);
  });

  test('owner signs in and reads admin data', () => {
    const t = adminToken();
    const d = g.call('adminData', { token: t });
    assert.equal(d.ok, true);
    assert.equal(d.data.me.role, 'super_admin');
    assert.match(d.data.links.calendar, /calendar\.google\.com/);
    assert.ok(d.data.activity.length > 0);
  });

  test('second sign-in supersedes the first', () => {
    const t1 = adminToken();
    const t2 = adminToken();
    assert.equal(g.call('adminPing', { token: t1 }).code, 'SUPERSEDED');
    assert.equal(g.call('adminPing', { token: t2 }).ok, true);
  });

  test('idle for 15 minutes locks; activity keeps alive', () => {
    const t = adminToken();
    for (let i = 0; i < 4; i++) {
      g.clock.advance(14 * MIN);
      assert.equal(g.call('adminPing', { token: t }).ok, true, 'ping ' + i);
    }
    g.clock.advance(15 * MIN + 1000);
    assert.equal(g.call('adminPing', { token: t }).code, 'IDLE');
  });

  test('admin token expires after 12h even if active', () => {
    const t = adminToken();
    for (let i = 0; i < 13; i++) { g.clock.advance(60 * MIN); g.call('adminPing', { token: t }); }
    assert.equal(g.call('adminPing', { token: t }).code, 'AUTH');
  });

  test('logout ends the session', () => {
    const t = adminToken();
    assert.equal(g.call('logout', { token: t }).ok, true);
    assert.notEqual(g.call('adminPing', { token: t }).ok, true);
  });
});

describe('approval gate and booking requests', () => {
  test('unapproved customer cannot book; request access notifies admin; approval emails customer', () => {
    const a = adminToken();
    const c = customerToken('cust@example.com');
    assert.equal(g.call('bookingRequest', Object.assign({ token: c }, booking())).code, 'NOT_APPROVED');

    const before = g.outbox.length;
    const ra = g.call('requestAccess', { token: c, name: 'Cust', mobile: '9876543210' });
    assert.equal(ra.data.access, 'pending');
    const notif = g.outbox.slice(before).find((m) => m.to === OWNER);
    assert.match(notif.subject, /access request/i);
    assert.equal(g.call('bookingRequest', Object.assign({ token: c }, booking())).code, 'NOT_APPROVED');

    const b2 = g.outbox.length;
    assert.equal(g.call('customerDecide', { token: a, email: 'cust@example.com', status: 'approved' }).ok, true);
    const mail = g.outbox.slice(b2).find((m) => m.to === 'cust@example.com');
    assert.match(mail.subject, /can now book/i);

    const r = g.call('bookingRequest', Object.assign({ token: c }, booking()));
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.data.status, 'pending');
    assert.equal(g.get('availability').data.dates[FUTURE[0]], 'pending');
    assert.equal(g.call('myBookings', { token: c }).data.bookings.length, 1);
    assert.ok(g.outbox.some((m) => m.to === OWNER && /booking request/i.test(m.subject)));
    noServerErrors();
  });

  test('max 3 pending per customer', () => {
    const { c } = approvedCustomer();
    for (let i = 0; i < 3; i++) assert.equal(g.call('bookingRequest', Object.assign({ token: c }, booking({ date: FUTURE[i] }))).ok, true);
    const r = g.call('bookingRequest', Object.assign({ token: c }, booking({ date: FUTURE[3] })));
    assert.equal(r.code, 'LIMIT');
  });

  test('blocked customer cannot book', () => {
    const { a, c } = approvedCustomer();
    g.call('customerDecide', { token: a, email: 'cust@example.com', status: 'blocked' });
    assert.equal(g.call('bookingRequest', Object.assign({ token: c }, booking())).code, 'NOT_APPROVED');
  });

  test('validation: past date, bad slot, bad mobile', () => {
    const { c } = approvedCustomer();
    assert.match(g.call('bookingRequest', Object.assign({ token: c }, booking({ date: '2026-11-16' }))).error, /future/);
    assert.equal(g.call('bookingRequest', Object.assign({ token: c }, booking({ slot: 'x' }))).ok, false);
    assert.equal(g.call('bookingRequest', Object.assign({ token: c }, booking({ mobile: '12' }))).ok, false);
    assert.equal(g.call('bookingRequest', Object.assign({ token: c }, booking({ date: '2030-01-01' }))).ok, false);
  });

  test('customer can cancel own pending request', () => {
    const { c } = approvedCustomer();
    const b = g.call('bookingRequest', Object.assign({ token: c }, booking())).data;
    assert.equal(g.call('myBookingCancel', { token: c, id: b.id }).data.status, 'cancelled');
    assert.deepEqual(g.get('availability').data.dates, {});
    assert.equal(g.call('myBookingCancel', { token: c, id: b.id }).ok, false);
  });

  test('formula injection is stored as literal text', () => {
    const { a, c } = approvedCustomer();
    const r = g.call('bookingRequest', Object.assign({ token: c }, booking({ name: '=HYPERLINK("x")', notes: '+SUM(1)' })));
    assert.equal(r.ok, true);
    const rows = g.sheets.dump('Bookings');
    const nameCell = rows[1][6];
    assert.equal(typeof nameCell, 'string');
    assert.equal(nameCell, '=HYPERLINK("x")');
    assert.ok(rows[1].every((v) => !(v && typeof v === 'object' && 'formula' in v)), 'no formula cells');
    assert.equal(g.call('adminData', { token: a }).data.bookings[0].name, '=HYPERLINK("x")');
  });

  test('sheet formula object is produced for unescaped "=" (mock sanity)', () => {
    // Column 6 of Bookings is "Guests", a number column (not plain-text formatted).
    g.sheets.get('Bookings').getRange(50, 6).setValue('=1+1');
    assert.deepEqual(g.sheets.get('Bookings').getRange(50, 6).getValue(), { formula: '=1+1' });
    g.sheets.get('Bookings').getRange(50, 6).setValue('');
  });

  test('a +91 mobile number is stored as typed (not escaped)', () => {
    const { a, c } = approvedCustomer();
    const r = g.call('bookingRequest', Object.assign({ token: c }, booking({ mobile: '+919841414699' })));
    assert.equal(r.ok, true);
    const stored = g.call('adminData', { token: a }).data.bookings.find((b) => b.id === r.data.id);
    assert.equal(stored.mobile, '+919841414699');
  });
});

describe('confirmation and conflicts', () => {
  test('confirm locks, creates calendar event, emails customer, marks booked', () => {
    const { a, c } = approvedCustomer();
    const b = g.call('bookingRequest', Object.assign({ token: c }, booking())).data;
    const before = g.outbox.length;
    const r = g.call('bookingUpdate', { token: a, id: b.id, changes: { status: 'confirmed' } });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.data.locked, true);
    assert.equal(r.data.status, 'confirmed');
    const evs = g.calendar.forBooking(b.id);
    assert.equal(evs.length, 1);
    assert.equal(r.data.eventId, evs[0].getId());
    assert.match(evs[0].getTitle(), /Wedding — Asha Rao/);
    assert.equal(g.get('availability').data.dates[FUTURE[0]], 'booked');
    assert.ok(g.outbox.slice(before).some((m) => m.to === 'cust@example.com' && /confirmed/i.test(m.subject)));
    noServerErrors();
  });

  test('second booking same date: cannot confirm (CONFLICT); customer request CONFLICT', () => {
    const { a, c } = approvedCustomer();
    const b1 = g.call('bookingRequest', Object.assign({ token: c }, booking())).data;
    const b2 = g.call('bookingRequest', Object.assign({ token: c }, booking({ name: 'Other' }))).data; // both pending: allowed
    assert.equal(g.call('bookingUpdate', { token: a, id: b1.id, changes: { status: 'confirmed' } }).ok, true);
    const r = g.call('bookingUpdate', { token: a, id: b2.id, changes: { status: 'confirmed' } });
    assert.equal(r.code, 'CONFLICT');
    assert.equal(g.call('bookingRequest', Object.assign({ token: c }, booking({ name: 'Third' }))).code, 'CONFLICT');
  });

  test('admin-created confirmed booking on an already booked date must conflict', () => {
    const a = adminToken();
    assert.equal(g.call('bookingCreate', Object.assign({ token: a, status: 'confirmed' }, booking())).ok, true);
    const r = g.call('bookingCreate', Object.assign({ token: a, status: 'confirmed' }, booking({ name: 'Dup' })));
    assert.equal(r.code, 'CONFLICT');
    assert.equal(g.sheets.dump('Bookings').length, 2);
  });

  test('pending admin-created booking is allowed on a booked date', () => {
    const a = adminToken();
    g.call('bookingCreate', Object.assign({ token: a, status: 'confirmed' }, booking()));
    assert.equal(g.call('bookingCreate', Object.assign({ token: a }, booking({ name: 'Waitlist' }))).ok, true);
  });
});

describe('locks and roles', () => {
  function confirmed() {
    const { owner, staff } = addAdmin();
    const b = g.call('bookingCreate', Object.assign({ token: owner, status: 'confirmed', amount: 1000, email: 'asha@example.com' }, booking())).data;
    return { owner, staff, b };
  }

  test('non-super admin: payment/note OK, core fields LOCKED, no delete, no unlock', () => {
    const { owner, staff, b } = confirmed();
    assert.equal(b.locked, true);
    const ok = g.call('bookingUpdate', { token: staff, id: b.id, changes: { amount: 5000, adminNote: 'advance paid' } });
    assert.equal(ok.ok, true, JSON.stringify(ok));
    assert.equal(ok.data.amount, 5000);
    assert.equal(g.call('bookingUpdate', { token: staff, id: b.id, changes: { date: FUTURE[1] } }).code, 'LOCKED');
    assert.equal(g.call('bookingUpdate', { token: staff, id: b.id, changes: { status: 'cancelled' } }).code, 'LOCKED');
    assert.equal(g.call('bookingDelete', { token: staff, id: b.id }).code, 'LOCKED');
    assert.equal(g.call('bookingLock', { token: staff, id: b.id, locked: false }).code, 'FORBIDDEN');

    assert.equal(g.call('bookingLock', { token: owner, id: b.id, locked: false }).ok, true);
    assert.equal(g.call('bookingUpdate', { token: staff, id: b.id, changes: { date: FUTURE[1] } }).ok, true);
    // calendar event moved with the booking
    assert.equal(g.calendar.forBooking(b.id)[0].getStartTime().getTime(), Date.parse(FUTURE[1] + 'T16:00:00+05:30'));
  });

  test('cancelling a confirmed booking removes its calendar event', () => {
    const { owner, b } = confirmed();
    const before = g.outbox.length;
    assert.equal(g.call('bookingUpdate', { token: owner, id: b.id, changes: { status: 'cancelled' } }).ok, true);
    assert.equal(g.calendar.forBooking(b.id).length, 0);
    assert.deepEqual(g.get('availability').data.dates, {});
    const row = g.call('adminData', { token: owner }).data.bookings[0];
    assert.equal(row.locked, false);
    assert.equal(row.eventId, '');
    assert.ok(g.outbox.slice(before).some((m) => m.to === 'asha@example.com' && /cancelled/i.test(m.subject)));
  });

  test('super admin can delete locked booking and its event', () => {
    const { owner, b } = confirmed();
    assert.equal(g.call('bookingDelete', { token: owner, id: b.id }).ok, true);
    assert.equal(g.calendar.forBooking(b.id).length, 0);
    assert.equal(g.sheets.dump('Bookings').length, 1);
  });

  test('only confirmed bookings can be locked', () => {
    const a = adminToken();
    const b = g.call('bookingCreate', Object.assign({ token: a }, booking())).data;
    assert.equal(g.call('bookingLock', { token: a, id: b.id, locked: true }).ok, false);
  });
});

describe('admin list', () => {
  test('non-super cannot adminAdd; owner cannot be removed; removed admin token fails', () => {
    const { owner, staff } = addAdmin();
    assert.equal(g.call('adminAdd', { token: staff, email: 'x@example.com', role: 'admin' }).code, 'FORBIDDEN');
    assert.match(g.call('adminRemove', { token: owner, email: OWNER }).error, /owner/i);
    assert.match(g.call('adminAdd', { token: owner, email: OWNER, role: 'admin' }).error, /owner/i);
    assert.equal(g.call('adminPing', { token: staff }).ok, true);
    assert.equal(g.call('adminRemove', { token: owner, email: 'staff@example.com' }).ok, true);
    assert.equal(g.call('adminPing', { token: staff }).code, 'AUTH');
    assert.equal(g.call('adminRemove', { token: owner, email: 'staff@example.com' }).code, 'NOT_FOUND');
  });
});

describe('Google Calendar is master', () => {
  function confirmedBooking(over) {
    const a = adminToken();
    const b = g.call('bookingCreate', Object.assign({ token: a, status: 'confirmed' }, booking(over))).data;
    return { a, b };
  }

  test('deleting the event in Calendar cancels the booking on sync', () => {
    const { a, b } = confirmedBooking();
    const ev = g.calendar.forBooking(b.id)[0];
    g.calendar.deleteDirect(ev.getId());
    // real Google still returns the deleted event by id
    assert.ok(g.calendar.get().getEventById(ev.getId()));
    const r = g.call('calendarSync', { token: a });
    assert.deepEqual(r.data, { created: 0, moved: 0, cancelled: 1, removed: 0 });
    const row = g.call('adminData', { token: a }).data.bookings[0];
    assert.equal(row.status, 'cancelled');
    assert.equal(row.locked, false);
    assert.match(row.adminNote, /deleted from Google Calendar/);
    assert.deepEqual(g.get('availability').data.dates, {});
  });

  test('moving the event changes the booking date', () => {
    const { a, b } = confirmedBooking();
    const ev = g.calendar.forBooking(b.id)[0];
    g.calendar.move(ev.getId(), Date.parse(FUTURE[2] + 'T16:00:00+05:30'), Date.parse(FUTURE[2] + 'T20:00:00+05:30'));
    const r = g.call('calendarSync', { token: a });
    assert.equal(r.data.moved, 1);
    assert.equal(g.call('adminData', { token: a }).data.bookings[0].date, FUTURE[2]);
    assert.equal(g.get('availability').data.dates[FUTURE[2]], 'booked');
    assert.equal(g.get('availability').data.dates[FUTURE[0]], undefined);
  });

  test('hourly trigger entry point works without a token', () => {
    const { b } = confirmedBooking();
    g.calendar.deleteDirect(g.calendar.forBooking(b.id)[0].getId());
    assert.equal(g.context.syncCalendar().cancelled, 1);
  });

  test('confirmed booking without an event gets one on sync', () => {
    const { a, b } = confirmedBooking();
    g.calendar.deleteDirect(g.calendar.forBooking(b.id)[0].getId());
    // simulate admin editing the sheet: confirmed row with blank event id
    const sh = g.sheets.get('Bookings');
    sh.getRange(2, 16).setValue('');
    assert.deepEqual(g.call('calendarSync', { token: a }).data.created, 1);
    assert.equal(g.calendar.forBooking(b.id).length, 1);
  });

  test('sheet status edit to rejected removes the event on sync', () => {
    const { a, b } = confirmedBooking();
    g.sheets.get('Bookings').getRange(2, 11).setValue('Rejected');
    assert.equal(g.call('calendarSync', { token: a }).data.removed, 1);
    assert.equal(g.calendar.forBooking(b.id).length, 0);
  });

  test('external all-day event blocks the date', () => {
    g.get('availability');
    g.calendar.addExternalAllDay(FUTURE[1], 'Family function');
    assert.equal(g.get('availability').data.dates[FUTURE[1]], undefined, 'cached empty result until invalidated');
    g.clock.advance(5 * MIN + 1000);
    assert.equal(g.get('availability').data.dates[FUTURE[1]], 'booked');
    const { c } = approvedCustomer();
    assert.equal(g.call('bookingRequest', Object.assign({ token: c }, booking({ date: FUTURE[1] }))).code, 'CONFLICT');
    assert.equal(g.call('bookingRequest', Object.assign({ token: c }, booking({ date: FUTURE[2] }))).ok, true);
  });

  test('multi-day external event blocks each day', () => {
    g.calendar.addExternalAllDay(FUTURE[0], 'Trip', 3);
    const d = g.get('availability').data.dates;
    assert.deepEqual([d[FUTURE[0]], d[FUTURE[1]], d[FUTURE[2]], d[FUTURE[3]]], ['booked', 'booked', 'booked', undefined]);
  });
});

describe('money', () => {
  test('income, expense, invalid category, super-only delete', () => {
    const { owner, staff } = addAdmin();
    const b = g.call('bookingCreate', Object.assign({ token: owner }, booking())).data;
    const inc = g.call('moneyAdd', { token: staff, type: 'income', category: 'Booking payment', amount: 25000.456, date: '2026-11-16', bookingId: b.id, description: 'Advance' });
    assert.equal(inc.ok, true, JSON.stringify(inc));
    assert.equal(inc.data.amount, 25000.46);
    assert.equal(inc.data.bookingId, b.id);
    const exp = g.call('moneyAdd', { token: staff, type: 'expense', category: 'Electricity (current) bill', amount: 4200, date: '2026-11-10' });
    assert.equal(exp.ok, true);
    for (const bad of [
      { type: 'income', category: 'Cleaning bill', amount: 1 },
      { type: 'expense', category: 'Booking payment', amount: 1 },
      { type: 'bogus', category: 'x', amount: 1 },
      { type: 'income', category: 'Other income', amount: 0 },
      { type: 'income', category: 'Other income', amount: -5 },
      { type: 'income', category: 'Other income', amount: 'abc' },
      { type: 'income', category: 'Booking payment', amount: 5, bookingId: 'BK-NOPE' },
    ]) assert.equal(g.call('moneyAdd', Object.assign({ token: staff, date: '2026-11-10' }, bad)).ok, false, JSON.stringify(bad));
    for (const cat of ['Catering commission', 'Other income']) assert.equal(g.call('moneyAdd', { token: staff, type: 'income', category: cat, amount: 10, date: '2026-11-10' }).ok, true);
    for (const cat of ['Cleaning bill', 'Other expense']) assert.equal(g.call('moneyAdd', { token: staff, type: 'expense', category: cat, amount: 10, date: '2026-11-10' }).ok, true);

    assert.equal(g.call('moneyDelete', { token: staff, id: inc.data.id }).code, 'FORBIDDEN');
    assert.equal(g.call('moneyDelete', { token: owner, id: inc.data.id }).ok, true);
    assert.equal(g.call('moneyDelete', { token: owner, id: inc.data.id }).code, 'NOT_FOUND');
    const money = g.call('adminData', { token: owner }).data.money;
    assert.equal(money.length, 5);
    assert.equal(money.find((m) => m.id === exp.data.id).type, 'expense');
    assert.equal(money.find((m) => m.id === exp.data.id).date, '2026-11-10');
  });
});

describe('settings', () => {
  test('bookingEnabled false closes online booking', () => {
    const { c } = approvedCustomer();
    const { owner, staff } = addAdmin();
    assert.equal(g.call('settingsSave', { token: staff, bookingEnabled: false }).code, 'FORBIDDEN');
    const r = g.call('settingsSave', { token: owner, bookingEnabled: false });
    assert.equal(r.data.bookingEnabled, false);
    assert.equal(g.get('status').data.bookingEnabled, false);
    assert.equal(g.call('bookingRequest', Object.assign({ token: c }, booking())).code, 'CLOSED');
    g.call('settingsSave', { token: owner, bookingEnabled: true, venueName: 'My Hall', notifyEmail: 'Alerts@Example.com' });
    assert.equal(g.get('status').data.venueName, 'My Hall');
    assert.equal(g.call('adminData', { token: owner }).data.settings.notifyEmail, 'alerts@example.com');
    assert.equal(g.call('bookingRequest', Object.assign({ token: c }, booking())).ok, true);
    assert.ok(g.outbox.some((m) => m.to === 'alerts@example.com'));
  });

  test('customer sendCode is CLOSED when not configured', () => {
    g.sheets.get('Settings').getRange(2, 1, 5, 2).setValues(Array.from({ length: 5 }, () => ['', '']));
    assert.equal(g.get('status').data.configured, false);
    assert.equal(g.call('sendCode', { email: 'c@example.com', purpose: 'customer' }).code, 'CLOSED');
  });
});

describe('importBookings', () => {
  test('maps labels and skips invalid rows with reasons', () => {
    const a = adminToken();
    const r = g.call('importBookings', {
      token: a,
      rows: [
        { date: FUTURE[0], slot: 'Full Day', eventType: 'Wedding', status: 'approved', name: 'Imp One', guests: 300, amount: 50000 },
        { date: 'not a date', name: 'Bad' },
        { date: FUTURE[1], slot: 'Morning (9 AM – 12 PM)', eventType: 'birthday', status: 'Pending', name: '' },
        { date: FUTURE[2], status: 'weird', name: 'X', guests: 0.5 },
      ],
    });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.data.imported, 2);
    assert.equal(r.data.skipped.length, 2);
    assert.match(r.data.skipped[0], /^Row 3: /);
    assert.match(r.data.skipped[1], /^Row 5: /);
    const rows = g.call('adminData', { token: a }).data.bookings;
    const one = rows.find((x) => x.name === 'Imp One');
    assert.equal(one.slot, 'fullday');
    assert.equal(one.eventType, 'wedding');
    assert.equal(one.status, 'confirmed');
    assert.equal(one.locked, true);
    assert.equal(one.source, 'import');
    assert.equal(one.amount, 50000);
    assert.ok(one.eventId, 'sync created a calendar event');
    assert.equal(g.calendar.forBooking(one.id).length, 1);
    const two = rows.find((x) => x.name === 'Unknown');
    assert.equal(two.slot, 'morning');
    assert.equal(two.eventType, 'birthday');
    assert.equal(two.status, 'pending');
    assert.equal(g.call('importBookings', { token: a, rows: 'x' }).data.imported, 0);
  });

  test('non-super cannot import', () => {
    const { staff } = addAdmin();
    assert.equal(g.call('importBookings', { token: staff, rows: [] }).code, 'FORBIDDEN');
  });
});

describe('mail budget', () => {
  test('daily mail budget makes sign-in codes fail with MAIL_LIMIT but notifications are skipped silently', () => {
    g.mail.quotaOverride = 3;
    assert.equal(g.call('sendCode', { email: 'c@example.com', purpose: 'customer' }).code, 'MAIL_LIMIT');
    g.mail.quotaOverride = null;
    g.props.set('mail-count', JSON.stringify({ day: '2026-11-17', n: 80 }));
    assert.equal(g.call('sendCode', { email: 'c@example.com', purpose: 'customer' }).code, 'MAIL_LIMIT');
    g.clock.advance(86400000);
    assert.equal(g.call('sendCode', { email: 'c@example.com', purpose: 'customer' }).ok, true);
  });
});


describe('private monthly PDF automation', () => {
  test('unauthenticated users and staff cannot export private reports', () => {
    assert.equal(g.call('monthlyReport', { month: '2026-11' }).code, 'AUTH');
    const { staff } = addAdmin();
    assert.equal(g.call('monthlyReport', { token: staff, month: '2026-11' }).code, 'FORBIDDEN');
    assert.equal(g.driveFiles.length, 0);
  });
  test('validates month and rejects future reports', () => {
    const a = adminToken();
    for (const month of ['2026-13', '2026-1', '2027-01', '<script>', null]) {
      assert.equal(g.call('monthlyReport', { token: a, month }).code, 'INVALID');
    }
  });
  test('exports by event month, escapes content, includes money and replaces prior PDF', () => {
    const a = adminToken();
    g.call('bookingCreate', { ...booking({ date: '2026-11-22', name: '<b>Guest</b>' }), token: a });
    g.call('bookingCreate', { ...booking(), token: a });
    g.call('moneyAdd', { token: a, date: '2026-11-05', type: 'income', category: 'Other income', amount: 250 });
    const result = g.call('monthlyReport', { token: a, month: '2026-11' });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.bookings, 1);
    const pdf = g.driveFiles[0];
    assert.equal(pdf.mime, 'application/pdf');
    assert.equal(pdf.name, 'Park-Inn-Bookings-2026-11.pdf');
    assert.match(pdf.html, /&lt;b&gt;Guest&lt;\/b&gt;/);
    assert.match(pdf.html, /INR 250.00/);
    assert.doesNotMatch(pdf.html, /2026-12-05/);
    g.call('monthlyReport', { token: a, month: '2026-11' });
    assert.equal(g.driveFiles.filter(f => !f.trashed).length, 1);
  });
  test('scheduled job exports previous month once, handles January and retries failure', () => {
    const original = g.context.Utilities.newBlob;
    g.context.Utilities.newBlob = () => { throw new Error('quota'); };
    assert.throws(() => g.context.monthlyReportJob(), /quota/);
    assert.equal(g.props.has('monthly-report-complete'), false);
    g.context.Utilities.newBlob = original;
    assert.equal(g.context.monthlyReportJob().month, '2026-10');
    assert.equal(g.context.monthlyReportJob().skipped, true);
    assert.equal(g.driveFiles.length, 1);
    g.clock.advance(Date.parse('2027-01-01T01:00:00Z') - T0);
    assert.equal(g.context.monthlyReportJob().month, '2026-12');
  });
  test('failed regeneration preserves previous PDF', () => {
    const a = adminToken();
    g.call('monthlyReport', { token: a, month: '2026-10' });
    g.context.Utilities.newBlob = () => { throw new Error('quota'); };
    assert.equal(g.call('monthlyReport', { token: a, month: '2026-10' }).ok, false);
    assert.equal(g.driveFiles[0].trashed, false);
  });
});

test('an editor cannot replace the registered owner by running setup', () => {
  g.context.Session.getEffectiveUser = () => ({ getEmail: () => 'editor@example.com' });
  assert.throws(() => g.runSetup(), /Only the venue owner/);
  assert.equal(g.context.settings_().ownerEmail, OWNER);
});

test('Google login trusts only the verified allowlisted Google identity', () => {
  g.props.set('GOOGLE_CLIENT_ID', 'public-id');
  g.props.set('GOOGLE_CLIENT_SECRET', 'test-secret');
  const request = { code: 'google-code', verifier: 'a'.repeat(43), email: OWNER };
  let email = 'visitor@gmail.com', verified = true, validCode = true;
  g.context.UrlFetchApp = { fetch(url, opts) {
    if (url.endsWith('/token')) {
      assert.equal(opts.payload.code_verifier, request.verifier);
      return { getResponseCode: () => validCode ? 200 : 400, getContentText: () => JSON.stringify({ access_token: 'access' }) };
    }
    assert.equal(opts.headers.Authorization, 'Bearer access');
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ sub:'account-id', email, email_verified:verified, hd:'example.com' }) };
  } };
  assert.equal(g.call('googleAdminLogin', request).code, 'FORBIDDEN');
  email = OWNER; verified = false;
  assert.equal(g.call('googleAdminLogin', request).code, 'FORBIDDEN');
  verified = true; validCode = false;
  assert.equal(g.call('googleAdminLogin', request).code, 'AUTH');
  validCode = true;
  const session = g.call('googleAdminLogin', request).data;
  assert.equal(session.admin.role, 'super_admin');
  assert.equal(g.call('adminData', {token:session.token}).ok, true);
  assert.equal(g.call('sendCode', {email:OWNER,purpose:'admin'}).code, 'AUTH');
});

test('overlapping verifications consume a sign-in code exactly once', () => {
  const email = 'guest@example.com';
  assert.ok(g.call('sendCode', { email }).ok);
  const request = { email, code: lastCode(email) };
  const cache = g.context.CacheService.getScriptCache();
  const originalGet = cache.get;
  let overlapping;
  cache.get = (key) => {
    const value = originalGet(key);
    if (key.startsWith('code:')) {
      cache.get = originalGet;
      overlapping = g.call('verifyCode', request);
    }
    return value;
  };
  g.context.CacheService.getScriptCache = () => cache;
  assert.ok(g.call('verifyCode', request).ok);
  assert.equal(overlapping.code, 'BUSY');
  assert.equal(g.call('verifyCode', request).code, 'CODE');
});

test('logout revokes only the selected customer session, including legacy tokens', () => {
  const email = 'guest@example.com';
  const first = customerToken(email);
  const second = customerToken(email);
  const legacy = g.context.sign_({ t: 'c', e: email, exp: T0 + MIN });
  for (const token of [first, legacy]) {
    assert.ok(g.call('myBookings', { token }).ok);
    assert.ok(g.call('logout', { token }).ok);
    assert.equal(g.call('myBookings', { token }).code, 'AUTH');
  }
  assert.ok(g.call('myBookings', { token: second }).ok);
  g.clock.advance(MIN);
  g.context.monthlyReportJob();
  assert.equal([...g.props.keys()].filter(k => k.startsWith('customer-revoked:')).length, 1);
  assert.equal(g.call('me', { token: first }).code, 'AUTH');
});

/**
 * Dhanlakshmi Park Inn — booking backend.
 *
 * Runs as a Google Apps Script inside the admin's own Google account:
 *   • data is stored in this Google Sheet (one tab per table),
 *   • confirmed bookings are written to a "Park Inn Bookings" Google Calendar,
 *   • sign-in codes and notifications are sent from the admin's Gmail.
 * No paid services, API keys or databases are needed.
 *
 * Setup (once): Extensions → Apps Script → paste this file → run `setup` →
 * Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 */

const VERSION = 2;
const TZ = 'Asia/Kolkata';

const SLOTS = {
  morning:   { label: 'Morning (9 AM – 12 PM)',  start: 9,  end: 12 },
  afternoon: { label: 'Afternoon (12 PM – 4 PM)', start: 12, end: 16 },
  evening:   { label: 'Evening (4 PM – 8 PM)',   start: 16, end: 20 },
  night:     { label: 'Night (8 PM – 12 AM)',    start: 20, end: 24 },
  fullday:   { label: 'Full day',                start: 9,  end: 22 },
};
const EVENT_TYPES = {
  wedding: 'Wedding', reception: 'Reception', birthday: 'Birthday Party',
  corporate: 'Corporate Meet', anniversary: 'Anniversary', other: 'Other',
};
const BOOKING_STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled'];
const CUSTOMER_STATUSES = ['pending', 'approved', 'rejected', 'blocked'];
const MONEY_CATEGORIES = {
  income:  ['Booking payment', 'Catering commission', 'Other income'],
  expense: ['Electricity (current) bill', 'Cleaning bill', 'Other expense'],
};

const CUSTOMER_TOKEN_DAYS = 30;
const ADMIN_TOKEN_HOURS = 12;
const ADMIN_IDLE_SECONDS = 15 * 60;
const CODE_TTL_SECONDS = 10 * 60;
const CODE_MAX_ATTEMPTS = 5;
const CODE_SENDS_PER_WINDOW = 3;       // per email per 15 minutes
const DAILY_MAIL_BUDGET = 80;          // consumer Gmail allows 100/day; keep headroom
const MAX_PENDING_PER_CUSTOMER = 3;
const AVAILABILITY_CACHE_SECONDS = 300;

// Sheet tabs: [field, column header]. Headers are what the admin sees in Google Sheets.
const TABLES = {
  Bookings: [
    ['id', 'Booking ID'], ['createdAt', 'Requested on'], ['date', 'Event date'],
    ['slot', 'Time slot'], ['eventType', 'Event type'], ['guests', 'Guests'],
    ['name', 'Name'], ['email', 'Email'], ['mobile', 'Mobile'], ['notes', 'Customer notes'],
    ['status', 'Status'], ['locked', 'Locked'], ['lockedBy', 'Locked by'],
    ['amount', 'Total amount (₹)'], ['adminNote', 'Admin note'], ['eventId', 'Calendar event ID'],
    ['updatedAt', 'Updated on'], ['updatedBy', 'Updated by'], ['source', 'Source'],
  ],
  Customers: [
    ['email', 'Email'], ['name', 'Name'], ['mobile', 'Mobile'], ['status', 'Status'],
    ['requestedAt', 'Requested on'], ['decidedBy', 'Decided by'], ['decidedAt', 'Decided on'], ['note', 'Note'],
  ],
  Money: [
    ['id', 'Entry ID'], ['date', 'Date'], ['type', 'Type'], ['category', 'Category'],
    ['amount', 'Amount (₹)'], ['bookingId', 'Booking ID'], ['description', 'Description'],
    ['recordedBy', 'Recorded by'], ['recordedAt', 'Recorded on'],
  ],
  Admins: [['email', 'Email'], ['role', 'Role'], ['addedBy', 'Added by'], ['addedAt', 'Added on']],
  Activity: [['time', 'Time'], ['who', 'Who'], ['action', 'Action'], ['details', 'Details']],
  Settings: [['key', 'Setting'], ['value', 'Value']],
};
const TIMESTAMP_FIELDS = ['createdAt', 'updatedAt', 'requestedAt', 'decidedAt', 'recordedAt', 'addedAt', 'time'];
const NON_TEXT_FIELDS = ['amount', 'guests', 'locked'];
// Every other column is formatted as plain text so Sheets never parses what customers type.
const isTextField_ = (field) => NON_TEXT_FIELDS.indexOf(field) < 0 && TIMESTAMP_FIELDS.indexOf(field) < 0;

const SETTING_KEYS = {
  venueName: 'Venue name',
  bookingEnabled: 'Online booking enabled',
  notifyEmail: 'Send notifications to',
  calendarId: 'Google Calendar ID',
  ownerEmail: 'Owner (super admin)',
};

/* ------------------------------------------------------------------ */
/* Web app entry points                                                */
/* ------------------------------------------------------------------ */

function doGet(e) {
  // GET is read-only and never carries tokens (URLs end up in logs).
  const action = e && e.parameter && e.parameter.action;
  return handle_({ action: action === 'availability' ? 'availability' : 'status' });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Bad request' });
  }
  return handle_(req);
}

const ROUTES = {
  // Public
  status: apiStatus_,
  availability: apiAvailability_,
  sendCode: apiSendCode_,
  verifyCode: apiVerifyCode_,
  logout: apiLogout_,
  // Customer
  me: apiMe_,
  requestAccess: apiRequestAccess_,
  bookingRequest: apiBookingRequest_,
  myBookings: apiMyBookings_,
  myBookingCancel: apiMyBookingCancel_,
  // Admin
  adminPing: (req) => requireAdmin_(req),
  adminData: apiAdminData_,
  bookingCreate: apiBookingCreate_,
  bookingUpdate: apiBookingUpdate_,
  bookingLock: apiBookingLock_,
  bookingDelete: apiBookingDelete_,
  customerDecide: apiCustomerDecide_,
  customerAdd: apiCustomerAdd_,
  moneyAdd: apiMoneyAdd_,
  moneyDelete: apiMoneyDelete_,
  settingsSave: apiSettingsSave_,
  adminAdd: apiAdminAdd_,
  adminRemove: apiAdminRemove_,
  calendarSync: apiCalendarSync_,
  importBookings: apiImportBookings_,
  monthlyReport: apiMonthlyReport_,
};

function handle_(req) {
  try {
    const route = ROUTES[req && req.action];
    if (!route) throw fail_('Unknown action', 'INVALID');
    return json_({ ok: true, data: route(req) });
  } catch (err) {
    if (err && err.userFacing) return json_({ ok: false, error: err.message, code: err.code });
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: 'Something went wrong. Please try again.', code: 'SERVER' });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(message, code) {
  const err = new Error(message);
  err.userFacing = true;
  err.code = code || 'INVALID';
  return err;
}

/* ------------------------------------------------------------------ */
/* Public endpoints                                                    */
/* ------------------------------------------------------------------ */

function apiStatus_() {
  const s = settings_();
  return {
    version: VERSION,
    configured: !!s.calendarId && !!s.ownerEmail,
    bookingEnabled: isBookingOpen_(s),
    venueName: s.venueName || 'Dhanlakshmi Park Inn',
  };
}

function apiAvailability_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('availability');
  if (cached) return JSON.parse(cached);
  const result = { dates: computeAvailability_() };
  cache.put('availability', JSON.stringify(result), AVAILABILITY_CACHE_SECONDS);
  return result;
}

/** { 'yyyy-MM-dd': 'booked' | 'pending' } for dates from a week ago onwards. */
function computeAvailability_() {
  const from = addDays_(today_(), -7);
  const dates = {};
  readTable_('Bookings').forEach((b) => {
    if (b.date < from) return;
    if (b.status === 'confirmed') dates[b.date] = 'booked';
    else if (b.status === 'pending' && !dates[b.date]) dates[b.date] = 'pending';
  });
  externalCalendarDates_(from).forEach((d) => { dates[d] = 'booked'; });
  return dates;
}

function apiSendCode_(req) {
  const email = normEmail_(req.email);
  const purpose = req.purpose === 'admin' ? 'admin' : 'customer';
  const s = settings_();
  if (purpose === 'admin' && !adminRole_(email)) {
    // Same reply as success so the admin list can't be probed.
    return { sent: true };
  }
  if (purpose === 'customer' && !apiStatus_().configured) throw fail_('Online booking is not open yet.', 'CLOSED');

  const cache = CacheService.getScriptCache();
  const sendsKey = 'code-sends:' + email;
  const sends = Number(cache.get(sendsKey) || 0);
  if (sends >= CODE_SENDS_PER_WINDOW) throw fail_('Too many codes requested. Please wait 15 minutes and try again.', 'RATE_LIMIT');

  const code = randomCode_();
  cache.put(codeKey_(purpose, email), JSON.stringify({ hash: hash_(code), attempts: 0, expires: Date.now() + CODE_TTL_SECONDS * 1000 }), CODE_TTL_SECONDS);
  cache.put(sendsKey, String(sends + 1), 15 * 60);

  const venue = s.venueName || 'Dhanlakshmi Park Inn';
  sendMail_(email, `${code} is your ${venue} sign-in code`,
    `<p>Your sign-in code is</p><p style="font-size:28px;letter-spacing:6px;font-weight:bold">${code}</p>` +
    `<p>It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>`, true);
  return { sent: true };
}

function apiVerifyCode_(req) {
  const email = normEmail_(req.email);
  const purpose = req.purpose === 'admin' ? 'admin' : 'customer';
  const code = String(req.code || '').replace(/\D/g, '');
  const cache = CacheService.getScriptCache();
  const key = codeKey_(purpose, email);
  const raw = cache.get(key);
  if (!raw) throw fail_('This code has expired. Please request a new one.', 'CODE');
  const entry = JSON.parse(raw);
  entry.attempts += 1;
  if (entry.attempts > CODE_MAX_ATTEMPTS) {
    cache.remove(key);
    throw fail_('Too many wrong attempts. Please request a new code.', 'CODE');
  }
  if (!safeEqual_(entry.hash, hash_(code))) {
    // Keep the original expiry: wrong guesses must not extend the code's life.
    const left = Math.floor(((entry.expires || 0) - Date.now()) / 1000);
    if (left > 0) cache.put(key, JSON.stringify(entry), left);
    else cache.remove(key);
    throw fail_('That code is not correct.', 'CODE');
  }
  cache.remove(key);

  if (purpose === 'customer') {
    const token = sign_({ t: 'c', e: email, exp: Date.now() + CUSTOMER_TOKEN_DAYS * 86400000 });
    return { token, profile: customerProfile_(email) };
  }

  const role = adminRole_(email);
  if (!role) throw fail_('This email is not an admin.', 'FORBIDDEN');
  // One device per admin: the newest sign-in replaces any older session.
  const props = PropertiesService.getScriptProperties();
  const previous = props.getProperty('admin-sid:' + email);
  const sid = Utilities.getUuid();
  props.setProperty('admin-sid:' + email, sid);
  if (previous) cache.remove('admin-seen:' + previous);
  cache.put('admin-seen:' + sid, '1', ADMIN_IDLE_SECONDS);
  log_(email, 'Admin signed in', previous ? 'Signed out the previous device' : '');
  const token = sign_({ t: 'a', e: email, sid: sid, exp: Date.now() + ADMIN_TOKEN_HOURS * 3600000 });
  return { token, admin: { email: email, role: role } };
}

function apiLogout_(req) {
  const p = verifyToken_(req.token, true);
  if (p && p.t === 'a') {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('admin-sid:' + p.e) === p.sid) props.deleteProperty('admin-sid:' + p.e);
    CacheService.getScriptCache().remove('admin-seen:' + p.sid);
  }
  return { signedOut: true };
}

/* ------------------------------------------------------------------ */
/* Customer endpoints                                                  */
/* ------------------------------------------------------------------ */

function apiMe_(req) {
  return customerProfile_(requireCustomer_(req));
}

function apiRequestAccess_(req) {
  const email = requireCustomer_(req);
  const name = str_(req.name, 100, true, 'Name');
  const mobile = mobile_(req.mobile);
  return withLock_(() => {
    const existing = findRow_('Customers', (c) => c.email === email);
    if (existing) return customerProfile_(email);
    insertRow_('Customers', { email, name, mobile, status: 'pending', requestedAt: new Date() });
    log_(email, 'Requested booking access', name);
    notifyAdmin_('New booking access request',
      `<p><b>${esc_(name)}</b> (${esc_(email)}, ${esc_(mobile)}) asked for booking access.</p>` +
      `<p>Approve or reject them in the admin panel under <b>Customers</b>.</p>`);
    return customerProfile_(email);
  });
}

function apiBookingRequest_(req) {
  const email = requireCustomer_(req);
  const s = settings_();
  if (!isBookingOpen_(s)) throw fail_('Online booking is closed right now. Please call us.', 'CLOSED');
  const customer = findRow_('Customers', (c) => c.email === email);
  if (!customer || customer.status !== 'approved') {
    throw fail_('Your account needs admin approval before you can book.', 'NOT_APPROVED');
  }
  const input = bookingInput_(req, false);
  if (input.date < today_()) throw fail_('Please choose a future date.');

  return withLock_(() => {
    if (bookedDates_().has(input.date)) throw fail_('Sorry, this date is already booked. Please choose another date.', 'CONFLICT');
    const mine = readTable_('Bookings').filter((b) => b.email === email && b.status === 'pending');
    if (mine.length >= MAX_PENDING_PER_CUSTOMER) {
      throw fail_(`You already have ${mine.length} requests waiting for review.`, 'LIMIT');
    }
    const booking = Object.assign({}, input, {
      id: newId_('BK'), createdAt: new Date(), email, status: 'pending', locked: false,
      updatedAt: new Date(), updatedBy: email, source: 'website',
    });
    insertRow_('Bookings', booking);
    invalidateAvailability_();
    log_(email, 'Requested a booking', `${booking.id} · ${booking.date} · ${EVENT_TYPES[booking.eventType]}`);
    notifyAdmin_('New booking request',
      `<p><b>${esc_(booking.name)}</b> requested <b>${esc_(EVENT_TYPES[booking.eventType])}</b> on ` +
      `<b>${esc_(prettyDate_(booking.date))}</b> (${esc_(SLOTS[booking.slot].label)}), ${booking.guests} guests.</p>` +
      `<p>Mobile: ${esc_(booking.mobile)} · Email: ${esc_(email)}</p>` +
      (booking.notes ? `<p>Notes: ${esc_(booking.notes)}</p>` : '') +
      `<p>Review it in the admin panel under <b>Bookings</b>.</p>`);
    return publicBooking_(booking);
  });
}

function apiMyBookings_(req) {
  const email = requireCustomer_(req);
  return {
    bookings: readTable_('Bookings')
      .filter((b) => b.email === email)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map(publicBooking_),
  };
}

function apiMyBookingCancel_(req) {
  const email = requireCustomer_(req);
  return withLock_(() => {
    const b = findRow_('Bookings', (x) => x.id === req.id && x.email === email);
    if (!b) throw fail_('Booking not found.', 'NOT_FOUND');
    if (b.status !== 'pending') throw fail_('Only requests that are still pending can be cancelled online. Please call us.');
    updateRow_('Bookings', b, { status: 'cancelled', updatedAt: new Date(), updatedBy: email });
    invalidateAvailability_();
    log_(email, 'Cancelled a booking request', b.id);
    return publicBooking_(Object.assign(b, { status: 'cancelled' }));
  });
}

/* ------------------------------------------------------------------ */
/* Admin endpoints                                                     */
/* ------------------------------------------------------------------ */

function apiAdminData_(req) {
  const admin = requireAdmin_(req);
  const s = settings_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    me: admin,
    automation: automationStatus_(),
    settings: {
      venueName: s.venueName || '',
      bookingEnabled: isBookingOpen_(s),
      notifyEmail: s.notifyEmail || '',
      ownerEmail: s.ownerEmail || '',
    },
    links: {
      sheet: ss.getUrl(),
      calendar: s.calendarId ? 'https://calendar.google.com/calendar/u/0/r?cid=' + encodeURIComponent(s.calendarId) : '',
    },
    bookings: readTable_('Bookings').map(strip_),
    customers: readTable_('Customers').map(strip_),
    money: readTable_('Money').map(strip_),
    admins: readTable_('Admins').map(strip_),
    activity: readTable_('Activity').slice(-300).reverse().map(strip_),
  };
}

function strip_(row) {
  const o = Object.assign({}, row);
  delete o._row;
  return o;
}

function apiBookingCreate_(req) {
  const admin = requireAdmin_(req);
  const input = bookingInput_(req, true);
  const status = req.status === 'confirmed' ? 'confirmed' : 'pending';
  return withLock_(() => {
    if (status === 'confirmed' && bookedDates_().has(input.date)) {
      throw fail_(`${prettyDate_(input.date)} is already booked.`, 'CONFLICT');
    }
    const booking = Object.assign({}, input, {
      id: newId_('BK'), createdAt: new Date(), status: 'pending', locked: false,
      amount: amount_(req.amount, true), adminNote: str_(req.adminNote, 500),
      updatedAt: new Date(), updatedBy: admin.email, source: 'admin',
    });
    insertRow_('Bookings', booking);
    log_(admin.email, 'Added a booking', `${booking.id} · ${booking.date}`);
    if (status === 'confirmed') confirmBooking_(booking, admin);
    invalidateAvailability_();
    return strip_(booking);
  });
}

function apiBookingUpdate_(req) {
  const admin = requireAdmin_(req);
  const changes = req.changes || {};
  return withLock_(() => {
    const b = findRow_('Bookings', (x) => x.id === req.id);
    if (!b) throw fail_('Booking not found.', 'NOT_FOUND');
    const isSuper = admin.role === 'super_admin';
    const patch = {};

    if ('amount' in changes) patch.amount = amount_(changes.amount, true);
    if ('adminNote' in changes) patch.adminNote = str_(changes.adminNote, 500);

    const core = {};
    if ('date' in changes) core.date = date_(changes.date);
    if ('slot' in changes) core.slot = oneOf_(changes.slot, Object.keys(SLOTS), 'time slot');
    if ('eventType' in changes) core.eventType = oneOf_(changes.eventType, Object.keys(EVENT_TYPES), 'event type');
    if ('guests' in changes) core.guests = guests_(changes.guests);
    if ('name' in changes) core.name = str_(changes.name, 100, true, 'Name');
    if ('mobile' in changes) core.mobile = mobile_(changes.mobile);
    if ('email' in changes) core.email = changes.email ? normEmail_(changes.email) : '';
    if ('notes' in changes) core.notes = str_(changes.notes, 1000);
    const newStatus = 'status' in changes ? oneOf_(changes.status, BOOKING_STATUSES, 'status') : b.status;

    const coreChanged = Object.keys(core).some((k) => String(core[k]) !== String(b[k])) || newStatus !== b.status;
    if (coreChanged && b.locked && !isSuper) {
      throw fail_('This booking is locked. Only payment details and notes can change until a super admin unlocks it.', 'LOCKED');
    }
    Object.assign(patch, core);
    patch.updatedAt = new Date();
    patch.updatedBy = admin.email;

    const after = Object.assign({}, b, patch);
    if (newStatus === 'confirmed' && (b.status !== 'confirmed' || after.date !== b.date)) {
      if (bookedDates_(b.id).has(after.date)) throw fail_(`${prettyDate_(after.date)} is already booked.`, 'CONFLICT');
    }
    const prevStatus = b.status;
    updateRow_('Bookings', b, patch);

    if (newStatus === 'confirmed') {
      if (prevStatus !== 'confirmed') confirmBooking_(b, admin);
      else if (Object.keys(core).length) upsertCalendarEvent_(b);
    } else if (newStatus !== prevStatus) {
      updateRow_('Bookings', b, { status: newStatus, locked: false, lockedBy: '' });
      removeCalendarEvent_(b);
      if (newStatus === 'rejected' || (prevStatus === 'confirmed' && newStatus === 'cancelled')) {
        notifyCustomer_(b, newStatus === 'rejected' ? 'Booking request not approved' : 'Booking cancelled',
          `<p>Your ${esc_(EVENT_TYPES[b.eventType] || 'event')} booking for <b>${esc_(prettyDate_(b.date))}</b> ` +
          (newStatus === 'rejected' ? 'could not be approved' : 'has been cancelled') +
          '. Please call us if you have any questions.</p>');
      }
    }
    log_(admin.email, 'Updated a booking', `${b.id}: ${Object.keys(changes).join(', ')}`);
    invalidateAvailability_();
    return strip_(b);
  });
}

function apiBookingLock_(req) {
  const admin = requireAdmin_(req, 'super_admin');
  return withLock_(() => {
    const b = findRow_('Bookings', (x) => x.id === req.id);
    if (!b) throw fail_('Booking not found.', 'NOT_FOUND');
    if (req.locked && b.status !== 'confirmed') throw fail_('Only confirmed bookings can be locked.');
    const patch = req.locked
      ? { locked: true, lockedBy: admin.email }
      : { locked: false, lockedBy: '' };
    updateRow_('Bookings', b, Object.assign(patch, { updatedAt: new Date(), updatedBy: admin.email }));
    log_(admin.email, req.locked ? 'Locked a booking' : 'Unlocked a booking', b.id);
    return strip_(Object.assign(b, patch));
  });
}

function apiBookingDelete_(req) {
  const admin = requireAdmin_(req);
  return withLock_(() => {
    const b = findRow_('Bookings', (x) => x.id === req.id);
    if (!b) throw fail_('Booking not found.', 'NOT_FOUND');
    if (b.locked && admin.role !== 'super_admin') throw fail_('This booking is locked. A super admin must unlock it first.', 'LOCKED');
    removeCalendarEvent_(b);
    deleteRow_('Bookings', b);
    log_(admin.email, 'Deleted a booking', `${b.id} · ${b.date} · ${b.name}`);
    invalidateAvailability_();
    return { deleted: b.id };
  });
}

function apiCustomerDecide_(req) {
  const admin = requireAdmin_(req);
  const email = normEmail_(req.email);
  const status = oneOf_(req.status, CUSTOMER_STATUSES, 'status');
  return withLock_(() => {
    const c = findRow_('Customers', (x) => x.email === email);
    if (!c) throw fail_('Customer not found.', 'NOT_FOUND');
    const wasApproved = c.status === 'approved';
    const patch = { status, decidedBy: admin.email, decidedAt: new Date() };
    if ('note' in req) patch.note = str_(req.note, 500);
    updateRow_('Customers', c, patch);
    log_(admin.email, 'Customer ' + status, email);
    if (status === 'approved' && !wasApproved) {
      notifyCustomer_({ email, name: c.name }, 'You can now book online',
        '<p>Your account has been approved. You can now pick a date and send a booking request on our website.</p>');
    }
    return strip_(c);
  });
}

function apiCustomerAdd_(req) {
  const admin = requireAdmin_(req);
  const email = normEmail_(req.email);
  return withLock_(() => {
    const row = {
      email, name: str_(req.name, 100), mobile: req.mobile ? mobile_(req.mobile) : '',
      status: 'approved', decidedBy: admin.email, decidedAt: new Date(), note: 'Added by admin',
    };
    const existing = findRow_('Customers', (x) => x.email === email);
    if (existing) updateRow_('Customers', existing, row);
    else insertRow_('Customers', Object.assign({ requestedAt: new Date() }, row));
    log_(admin.email, 'Customer approved', email);
    return strip_(row);
  });
}

function apiMoneyAdd_(req) {
  const admin = requireAdmin_(req);
  const type = oneOf_(req.type, Object.keys(MONEY_CATEGORIES), 'type');
  const category = oneOf_(req.category, MONEY_CATEGORIES[type], 'category');
  const entry = {
    id: newId_('TX'),
    date: date_(req.date),
    type, category,
    amount: amount_(req.amount, false),
    bookingId: req.bookingId ? String(req.bookingId).slice(0, 40) : '',
    description: str_(req.description, 300),
    recordedBy: admin.email,
    recordedAt: new Date(),
  };
  return withLock_(() => {
    if (entry.bookingId && !findRow_('Bookings', (b) => b.id === entry.bookingId)) throw fail_('Booking not found.', 'NOT_FOUND');
    insertRow_('Money', entry);
    log_(admin.email, type === 'income' ? 'Recorded income' : 'Recorded an expense', `${category} · ₹${entry.amount}`);
    return strip_(entry);
  });
}

function apiMoneyDelete_(req) {
  const admin = requireAdmin_(req, 'super_admin');
  return withLock_(() => {
    const m = findRow_('Money', (x) => x.id === req.id);
    if (!m) throw fail_('Entry not found.', 'NOT_FOUND');
    deleteRow_('Money', m);
    log_(admin.email, 'Deleted a money entry', `${m.category} · ₹${m.amount} · ${m.date}`);
    return { deleted: m.id };
  });
}

function apiSettingsSave_(req) {
  const admin = requireAdmin_(req, 'super_admin');
  const changes = {};
  if ('venueName' in req) changes.venueName = str_(req.venueName, 80, true, 'Venue name');
  if ('bookingEnabled' in req) changes.bookingEnabled = req.bookingEnabled === true ? 'Yes' : 'No';
  if ('notifyEmail' in req) changes.notifyEmail = normEmail_(req.notifyEmail);
  withLock_(() => Object.keys(changes).forEach((k) => setSetting_(k, changes[k])));
  invalidateAvailability_();
  log_(admin.email, 'Changed settings', Object.keys(changes).map((k) => `${SETTING_KEYS[k]}: ${changes[k]}`).join('; '));
  return apiStatus_();
}

function apiAdminAdd_(req) {
  const admin = requireAdmin_(req, 'super_admin');
  const email = normEmail_(req.email);
  const role = oneOf_(req.role, ['admin', 'super_admin'], 'role');
  return withLock_(() => {
    const existing = findRow_('Admins', (a) => a.email === email);
    if (existing) {
      if (email === settings_().ownerEmail) throw fail_('The owner is always a super admin.');
      updateRow_('Admins', existing, { role });
    } else {
      insertRow_('Admins', { email, role, addedBy: admin.email, addedAt: new Date() });
    }
    log_(admin.email, 'Added an admin', `${email} (${role})`);
    return { email, role };
  });
}

function apiAdminRemove_(req) {
  const admin = requireAdmin_(req, 'super_admin');
  const email = normEmail_(req.email);
  if (email === settings_().ownerEmail) throw fail_('The owner account cannot be removed.');
  return withLock_(() => {
    const a = findRow_('Admins', (x) => x.email === email);
    if (!a) throw fail_('Admin not found.', 'NOT_FOUND');
    deleteRow_('Admins', a);
    PropertiesService.getScriptProperties().deleteProperty('admin-sid:' + email);
    log_(admin.email, 'Removed an admin', email);
    return { removed: email };
  });
}

function apiCalendarSync_(req) {
  requireAdmin_(req);
  return syncCalendar();
}

function apiImportBookings_(req) {
  const admin = requireAdmin_(req, 'super_admin');
  const rows = Array.isArray(req.rows) ? req.rows.slice(0, 2000) : [];
  const statusMap = { approved: 'confirmed', booked: 'confirmed', confirmed: 'confirmed', pending: 'pending', rejected: 'rejected', cancelled: 'cancelled' };
  const slotLabels = {};
  Object.keys(SLOTS).forEach((k) => { slotLabels[k] = SLOTS[k].label; });
  let imported = 0;
  const skipped = [];
  withLock_(() => {
    rows.forEach((r, i) => {
      try {
        const status = statusMap[String(r.status || '').trim().toLowerCase()] || 'pending';
        const booking = {
          id: newId_('BK'), createdAt: new Date(), date: date_(r.date),
          slot: matchOption_(r.slot, slotLabels) || 'fullday',
          eventType: matchOption_(r.eventType, EVENT_TYPES) || 'other',
          guests: r.guests ? guests_(r.guests) : '', name: str_(r.name, 100) || 'Unknown',
          email: r.email ? normEmail_(r.email) : '', mobile: r.mobile ? String(r.mobile).slice(0, 20) : '',
          notes: str_(r.notes, 1000), status, locked: status === 'confirmed', lockedBy: status === 'confirmed' ? 'import' : '',
          amount: r.amount ? amount_(r.amount, true) : '', updatedAt: new Date(), updatedBy: admin.email, source: 'import',
        };
        insertRow_('Bookings', booking);
        imported += 1;
      } catch (err) {
        skipped.push(`Row ${i + 2}: ${err.message}`);
      }
    });
  });
  log_(admin.email, 'Imported bookings', `${imported} imported, ${skipped.length} skipped`);
  invalidateAvailability_();
  syncCalendar();
  return { imported, skipped: skipped.slice(0, 50) };
}

/* ------------------------------------------------------------------ */
/* Booking + calendar logic                                            */
/* ------------------------------------------------------------------ */

function confirmBooking_(b, admin) {
  const patch = { status: 'confirmed', locked: true, lockedBy: admin.email };
  updateRow_('Bookings', b, patch);
  Object.assign(b, patch);
  upsertCalendarEvent_(b);
  notifyCustomer_(b, 'Your booking is confirmed',
    `<p>Your <b>${esc_(EVENT_TYPES[b.eventType] || 'event')}</b> on <b>${esc_(prettyDate_(b.date))}</b> ` +
    `(${esc_((SLOTS[b.slot] || {}).label || '')}) is confirmed. We look forward to hosting you!</p>`);
}

/** Dates taken by confirmed bookings (except `exceptId`) or blocked in the venue calendar. */
function bookedDates_(exceptId) {
  const from = today_();
  const set = new Set(externalCalendarDates_(from));
  readTable_('Bookings').forEach((b) => {
    if (b.status === 'confirmed' && b.id !== exceptId && b.date >= from) set.add(b.date);
  });
  return set;
}

function venueCalendar_() {
  const id = settings_().calendarId;
  return id ? CalendarApp.getCalendarById(id) : null;
}

/** Dates of events the admin added directly in the venue calendar (not created by this script). */
function externalCalendarDates_(from) {
  const cal = venueCalendar_();
  if (!cal) return [];
  const start = parseDate_(from);
  const end = parseDate_(addDays_(today_(), 730));
  const dates = [];
  cal.getEvents(start, end).forEach((ev) => {
    if (ev.getTag('bookingId')) return;
    const first = ev.isAllDayEvent() ? ev.getAllDayStartDate() : ev.getStartTime();
    const last = new Date((ev.isAllDayEvent() ? ev.getAllDayEndDate() : ev.getEndTime()).getTime() - 1);
    for (let d = formatDay_(first); d <= formatDay_(last) && dates.length < 2000; d = addDays_(d, 1)) {
      if (d >= from) dates.push(d);
    }
  });
  return dates;
}

function upsertCalendarEvent_(b) {
  const cal = venueCalendar_();
  if (!cal) return;
  const slot = SLOTS[b.slot] || SLOTS.fullday;
  const start = atHour_(b.date, slot.start);
  const end = atHour_(b.date, slot.end);
  const title = `${EVENT_TYPES[b.eventType] || 'Event'} — ${b.name}`;
  const description = [
    `Booking ID: ${b.id}`,
    b.guests ? `Guests: ${b.guests}` : '',
    b.mobile ? `Mobile: ${b.mobile}` : '',
    b.email ? `Email: ${b.email}` : '',
    b.notes ? `Notes: ${b.notes}` : '',
  ].filter(Boolean).join('\n');

  let ev = b.eventId ? cal.getEventById(b.eventId) : null;
  if (ev) {
    ev.setTime(start, end);
    ev.setTitle(title);
    ev.setDescription(description);
  } else {
    ev = cal.createEvent(title, start, end, { description });
    ev.setTag('bookingId', b.id);
    updateRow_('Bookings', b, { eventId: ev.getId() });
    b.eventId = ev.getId();
  }
}

function removeCalendarEvent_(b) {
  if (!b.eventId) return;
  const cal = venueCalendar_();
  const ev = cal ? cal.getEventById(b.eventId) : null;
  if (ev) ev.deleteEvent();
  updateRow_('Bookings', b, { eventId: '' });
  b.eventId = '';
}

/**
 * Two-way reconcile between the Bookings sheet and the venue calendar.
 * Runs every 15 minutes (trigger) and from the admin panel. Also applies status edits
 * the admin made directly in the sheet.
 */
function syncCalendar() {
  const cal = venueCalendar_();
  if (!cal) throw fail_('Calendar is unavailable. Run setup from the owner Google account.', 'CONFIG');
  let created = 0, moved = 0, cancelled = 0, removed = 0;
  const from = addDays_(today_(), -7);
  withLock_(() => {
    readTable_('Bookings').forEach((b) => {
      if (b.status === 'confirmed') {
        if (b.date < from) return;
        if (!b.eventId) {
          upsertCalendarEvent_(b);
          created += 1;
          return;
        }
        const ev = liveEvent_(cal, b.eventId);
        if (!ev) {
          // Deleted in Google Calendar: the calendar is the master.
          updateRow_('Bookings', b, {
            status: 'cancelled', locked: false, lockedBy: '', eventId: '',
            adminNote: trimJoin_(b.adminNote, 'Event was deleted from Google Calendar'),
            updatedAt: new Date(), updatedBy: 'Google Calendar',
          });
          log_('Google Calendar', 'Booking cancelled (event deleted)', `${b.id} · ${b.date}`);
          cancelled += 1;
          return;
        }
        const day = formatDay_(ev.isAllDayEvent() ? ev.getAllDayStartDate() : ev.getStartTime());
        if (day !== b.date) {
          // Follow the calendar, but flag a clash so the admin can sort it out.
          const clash = bookedDates_(b.id).has(day);
          updateRow_('Bookings', b, {
            date: day, updatedAt: new Date(), updatedBy: 'Google Calendar',
            adminNote: clash ? trimJoin_(b.adminNote, 'Moved in Google Calendar onto a date that is already booked') : b.adminNote,
          });
          log_('Google Calendar', clash ? 'Booking moved — date clash' : 'Booking moved', `${b.id}: ${b.date} → ${day}`);
          moved += 1;
        }
      } else if (b.eventId) {
        removeCalendarEvent_(b);
        removed += 1;
      }
    });
  });
  invalidateAvailability_();
  PropertiesService.getScriptProperties().setProperty('last-calendar-sync', new Date().toISOString());
  return { created, moved, cancelled, removed };
}

/**
 * getEventById can still return an event after it was deleted, so only treat
 * it as live when it also shows up in a normal listing for its own time.
 */
function liveEvent_(cal, eventId) {
  const ev = cal.getEventById(eventId);
  if (!ev) return null;
  const listed = cal.getEvents(ev.getStartTime(), ev.getEndTime()).some((e) => e.getId() === eventId);
  return listed ? ev : null;
}

function isBookingOpen_(s) {
  return !!s.calendarId && !!s.ownerEmail && !/^(no|false|off|0)$/i.test(String(s.bookingEnabled || 'Yes').trim());
}

function invalidateAvailability_() {
  CacheService.getScriptCache().remove('availability');
}

function publicBooking_(b) {
  return {
    id: b.id, date: b.date, slot: b.slot, eventType: b.eventType, guests: b.guests,
    name: b.name, mobile: b.mobile, notes: b.notes, status: b.status, createdAt: b.createdAt,
  };
}

function bookingInput_(req, adminCreated) {
  return {
    date: date_(req.date),
    slot: oneOf_(req.slot, Object.keys(SLOTS), 'time slot'),
    eventType: oneOf_(req.eventType, Object.keys(EVENT_TYPES), 'event type'),
    guests: guests_(req.guests),
    name: str_(req.name, 100, true, 'Name'),
    mobile: mobile_(req.mobile),
    notes: str_(req.notes, 1000),
    email: adminCreated ? (req.email ? normEmail_(req.email) : '') : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

function requireCustomer_(req) {
  const p = verifyToken_(req.token);
  if (p.t !== 'c') throw fail_('Please sign in again.', 'AUTH');
  return p.e;
}

function requireAdmin_(req, needRole) {
  const p = verifyToken_(req.token);
  if (p.t !== 'a') throw fail_('Please sign in as an admin.', 'AUTH');
  const role = adminRole_(p.e);
  if (!role) throw fail_('You are no longer an admin.', 'AUTH');
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('admin-sid:' + p.e) !== p.sid) {
    throw fail_('You were signed out because this admin account signed in on another device.', 'SUPERSEDED');
  }
  const cache = CacheService.getScriptCache();
  if (!cache.get('admin-seen:' + p.sid)) {
    throw fail_('The admin panel locked after 15 minutes of inactivity. Please sign in again.', 'IDLE');
  }
  cache.put('admin-seen:' + p.sid, '1', ADMIN_IDLE_SECONDS);
  if (needRole === 'super_admin' && role !== 'super_admin') throw fail_('Only a super admin can do this.', 'FORBIDDEN');
  return { email: p.e, role };
}

function adminRole_(email) {
  if (!email) return null;
  if (email === settings_().ownerEmail) return 'super_admin';
  const a = findRow_('Admins', (x) => x.email === email);
  return a ? (a.role === 'super_admin' ? 'super_admin' : 'admin') : null;
}

function customerProfile_(email) {
  const c = findRow_('Customers', (x) => x.email === email);
  return {
    email,
    name: c ? c.name : '',
    mobile: c ? c.mobile : '',
    access: c ? c.status : 'none',
  };
}

function sign_(payload) {
  const body = Utilities.base64EncodeWebSafe(JSON.stringify(payload), Utilities.Charset.UTF_8);
  return body + '.' + Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, secret_()));
}

function verifyToken_(token, lenient) {
  const parts = String(token || '').split('.');
  let payload = null;
  if (parts.length === 2) {
    const expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], secret_()));
    if (safeEqual_(expected, parts[1])) {
      try {
        payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0], Utilities.Charset.UTF_8)).getDataAsString());
      } catch (e) {
        payload = null;
      }
    }
  }
  if (!payload || !payload.e || !(payload.exp > Date.now())) {
    if (lenient) return null;
    throw fail_('Your session has ended. Please sign in again.', 'AUTH');
  }
  return payload;
}

function secret_() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty('secret');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('secret', s);
  }
  return s;
}

function hash_(value) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(value), secret_()));
}

function safeEqual_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomCode_() {
  const hex = Utilities.getUuid().replace(/-/g, '');
  return String(parseInt(hex.slice(0, 12), 16) % 1000000).padStart(6, '0');
}

function codeKey_(purpose, email) {
  return 'code:' + purpose + ':' + email;
}

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

function sendMail_(to, subject, html, mustSend) {
  const props = PropertiesService.getScriptProperties();
  const counter = JSON.parse(props.getProperty('mail-count') || '{}');
  const used = counter.day === today_() ? counter.n : 0;
  if (used >= DAILY_MAIL_BUDGET || MailApp.getRemainingDailyQuota() < 5) {
    if (mustSend) throw fail_('Our email limit for today has been reached. Please call us or try again tomorrow.', 'MAIL_LIMIT');
    return;
  }
  try {
    MailApp.sendEmail({ to, subject, htmlBody: html, name: settings_().venueName || 'Dhanlakshmi Park Inn' });
    props.setProperty('mail-count', JSON.stringify({ day: today_(), n: used + 1 }));
  } catch (err) {
    if (mustSend) throw fail_('We could not send the email. Please check the address and try again.', 'MAIL');
    console.error('mail failed: ' + err);
  }
}

function notifyAdmin_(subject, html) {
  const to = settings_().notifyEmail || settings_().ownerEmail;
  if (to) sendMail_(to, subject, html + '<p style="color:#888">— Park Inn booking system</p>', false);
}

function notifyCustomer_(b, subject, html) {
  if (!b.email) return;
  sendMail_(b.email, subject, `<p>Hello ${esc_(b.name || '')},</p>${html}<p>— ${esc_(settings_().venueName || 'Dhanlakshmi Park Inn')}</p>`, false);
}

/* ------------------------------------------------------------------ */
/* Sheet storage                                                       */
/* ------------------------------------------------------------------ */

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw fail_('The booking system is not set up yet.', 'NOT_CONFIGURED');
  return sh;
}

function readTable_(name) {
  const cols = TABLES[name];
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  const rows = [];
  values.forEach((vals, i) => {
    if (vals.every((v) => v === '' || v === null)) return;
    const row = { _row: i + 2 };
    cols.forEach(([field], c) => { row[field] = fromCell_(field, vals[c]); });
    rows.push(row);
  });
  return rows;
}

function findRow_(name, predicate) {
  return readTable_(name).find(predicate) || null;
}

function insertRow_(name, obj) {
  const sh = sheet_(name);
  sh.appendRow(TABLES[name].map(([field]) => toCell_(field, obj[field])));
  obj._row = sh.getLastRow(); // lets callers update the row they just added
}

function updateRow_(name, row, patch) {
  const cols = TABLES[name];
  const merged = Object.assign({}, row, patch);
  sheet_(name).getRange(row._row, 1, 1, cols.length).setValues([cols.map(([field]) => toCell_(field, merged[field]))]);
  Object.assign(row, patch);
}

function deleteRow_(name, row) {
  sheet_(name).deleteRow(row._row);
}

function toCell_(field, v) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date || typeof v === 'number' || typeof v === 'boolean') return v;
  const s = String(v);
  // Belt and braces next to the plain-text format: an apostrophe stops formula parsing.
  // "+9198…" (a phone number) is left alone because digits alone can't form a formula.
  return /^[=@]/.test(s) || /^[+-](?!\d+$)/.test(s) ? "'" + s : s;
}

function fromCell_(field, v) {
  if (v instanceof Date) {
    if (TIMESTAMP_FIELDS.indexOf(field) >= 0) return v.toISOString();
    return formatDay_(v);
  }
  if (field === 'locked') return v === true || String(v).toUpperCase() === 'TRUE';
  if (field === 'email') return String(v).trim().toLowerCase();
  if (field === 'status' || field === 'slot' || field === 'eventType' || field === 'type' || field === 'role') {
    return String(v).trim().toLowerCase().replace(/\s+/g, field === 'role' ? '_' : '');
  }
  if (isTextField_(field)) return String(v).replace(/^'/, '');
  return v;
}

function settings_() {
  const out = {};
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  if (!sh || sh.getLastRow() < 2) return out;
  const labels = {};
  Object.keys(SETTING_KEYS).forEach((k) => { labels[SETTING_KEYS[k]] = k; });
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(([label, value]) => {
    const key = labels[String(label).trim()];
    const text = String(value).replace(/^'/, '').trim();
    if (key) out[key] = key === 'ownerEmail' || key === 'notifyEmail' ? text.toLowerCase() : text;
  });
  return out;
}

function setSetting_(key, value) {
  const sh = sheet_('Settings');
  const label = SETTING_KEYS[key];
  const last = sh.getLastRow();
  const labels = last >= 2 ? sh.getRange(2, 1, last - 1, 1).getValues().map((r) => String(r[0]).trim()) : [];
  const idx = labels.indexOf(label);
  if (idx >= 0) sh.getRange(idx + 2, 2).setValue(toCell_('value', value));
  else sh.appendRow([label, toCell_('value', value)]);
}

function log_(who, action, details) {
  try {
    const sh = sheet_('Activity');
    sh.appendRow([new Date(), toCell_('who', who), toCell_('action', action), toCell_('details', details || '')]);
    if (sh.getLastRow() > 5001) sh.deleteRows(2, sh.getLastRow() - 5001);
  } catch (err) {
    console.error('log failed: ' + err);
  }
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw fail_('The system is busy. Please try again in a moment.', 'BUSY');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Validation + date helpers                                           */
/* ------------------------------------------------------------------ */

function str_(v, max, required, label) {
  const s = String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim();
  if (required && !s) throw fail_(`${label || 'This field'} is required.`);
  if (s.length > max) throw fail_(`${label || 'Text'} is too long (max ${max} characters).`);
  return s;
}

function normEmail_(v) {
  const e = String(v || '').trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/.test(e)) throw fail_('Please enter a valid email address.');
  return e;
}

function mobile_(v) {
  const m = String(v || '').replace(/[\s-]/g, '');
  if (!/^\+?\d{10,13}$/.test(m)) throw fail_('Please enter a valid mobile number.');
  return m;
}

function guests_(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5000) throw fail_('Please enter a valid number of guests.');
  return n;
}

function amount_(v, allowEmpty) {
  if (allowEmpty && (v === '' || v === null || v === undefined)) return '';
  const n = Math.round(Number(v) * 100) / 100;
  if (!isFinite(n) || n < 0 || n > 100000000) throw fail_('Please enter a valid amount.');
  if (!allowEmpty && n <= 0) throw fail_('Amount must be more than zero.');
  return n;
}

function oneOf_(v, allowed, label) {
  const s = String(v || '').trim();
  if (allowed.indexOf(s) < 0) throw fail_(`Please choose a valid ${label}.`);
  return s;
}

function date_(v) {
  const s = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || formatDay_(parseDate_(s)) !== s) throw fail_('Please choose a valid date.');
  if (s > addDays_(today_(), 730)) throw fail_('Bookings open up to two years ahead.');
  return s;
}

function today_() {
  return formatDay_(new Date());
}

function formatDay_(d) {
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

/** Noon in the venue time zone, so day arithmetic never crosses a date boundary. */
function parseDate_(s) {
  return new Date(s + 'T12:00:00+05:30');
}

function atHour_(day, hour) {
  return new Date(parseDate_(day).getTime() + (hour - 12) * 3600000);
}

function addDays_(day, n) {
  return formatDay_(new Date(parseDate_(day).getTime() + n * 86400000));
}

function prettyDate_(day) {
  return Utilities.formatDate(parseDate_(day), TZ, 'EEE, d MMM yyyy');
}

function newId_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-' +
    Utilities.getUuid().replace(/-/g, '').slice(0, 5).toUpperCase();
}

function esc_(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function trimJoin_(a, b) {
  return [a, b].filter(Boolean).join(' · ').slice(0, 500);
}

/** Matches "Full Day", "fullday" or "Full day" to the option key. */
function matchOption_(value, labels) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  const v = norm(value);
  if (!v) return null;
  return Object.keys(labels).find((k) => norm(k) === v || norm(labels[k]) === v || norm(labels[k]).indexOf(v) === 0) || null;
}

/* ------------------------------------------------------------------ */
/* One-time setup + sheet menu                                         */
/* ------------------------------------------------------------------ */

/** Run once from the Apps Script editor. Safe to run again (repairs missing pieces). */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open this script from your Google Sheet: Extensions → Apps Script.');
  const owner = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!owner) throw new Error('Could not read your Google account email. Please run setup again.');
  ss.setSpreadsheetTimeZone(TZ);

  Object.keys(TABLES).forEach((name) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const cols = TABLES[name];
    sh.getRange(1, 1, 1, cols.length).setValues([cols.map(([, header]) => header)])
      .setFontWeight('bold').setBackground('#1c1917').setFontColor('#f5f0e8');
    sh.setFrozenRows(1);
    cols.forEach(([field], i) => {
      if (isTextField_(field)) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
      if (field === 'amount') sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('₹#,##0.00');
      sh.setColumnWidth(i + 1, ['notes', 'description', 'details', 'adminNote'].indexOf(field) >= 0 ? 280 : 150);
    });
  });
  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  const s = settings_();
  let calendarId = s.calendarId;
  if (!calendarId || !CalendarApp.getCalendarById(calendarId)) {
    const cal = CalendarApp.createCalendar('Park Inn Bookings', { timeZone: TZ, color: CalendarApp.Color.YELLOW });
    calendarId = cal.getId();
  }
  if (!s.venueName) setSetting_('venueName', 'Dhanlakshmi Park Inn');
  if (!s.bookingEnabled) setSetting_('bookingEnabled', 'Yes');
  if (!s.notifyEmail) setSetting_('notifyEmail', owner);
  setSetting_('calendarId', calendarId);
  setSetting_('ownerEmail', owner);
  if (!findRow_('Admins', (a) => a.email === owner)) {
    insertRow_('Admins', { email: owner, role: 'super_admin', addedBy: 'setup', addedAt: new Date() });
  }
  secret_();

  // Replace only our triggers: upgrades cannot leave duplicate scheduled jobs.
  ScriptApp.getProjectTriggers().filter((t) => ['syncCalendar', 'monthlyReportJob'].includes(t.getHandlerFunction())).forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncCalendar').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('monthlyReportJob').timeBased().everyDays(1).atHour(6).inTimezone(TZ).create();
  reportFolder_();

  log_(owner, 'Setup completed', 'Version ' + VERSION);
  invalidateAvailability_();
  return 'Setup complete. Next: Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).';
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Park Inn')
    .addItem('Set up / repair', 'setup')
    .addItem('Sync with Google Calendar now', 'syncCalendar')
    .addToUi();
}


/* Private monthly archives. No public sharing or third-party PDF service. */
function automationStatus_() {
  const p = PropertiesService.getScriptProperties();
  const handlers = ScriptApp.getProjectTriggers().map((t) => t.getHandlerFunction());
  return {
    calendarScheduled: handlers.includes('syncCalendar'),
    reportsScheduled: handlers.includes('monthlyReportJob'),
    lastSync: p.getProperty('last-calendar-sync') || '',
    lastReport: p.getProperty('last-monthly-report') || '',
    reportsFolder: p.getProperty('reports-folder') ? 'https://drive.google.com/drive/folders/' + p.getProperty('reports-folder') : '',
  };
}

function reportFolder_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('reports-folder');
  if (id) {
    const folder = DriveApp.getFolderById(id);
    if (folder.isTrashed()) throw new Error('Restore the monthly reports folder from Drive trash.');
    return folder;
  }
  const folder = DriveApp.createFolder('Park Inn Monthly Reports');
  p.setProperty('reports-folder', folder.getId());
  return folder;
}

function reportMonth_(month) {
  if (typeof month !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) {
    throw fail_('Choose a valid month (YYYY-MM).', 'INVALID');
  }
  if (month > today_().slice(0, 7)) throw fail_('Choose the current month or an earlier month.', 'INVALID');
  return month;
}

function apiMonthlyReport_(req) {
  const admin = requireAdmin_(req, 'super_admin');
  return withLock_(() => createMonthlyReport_(reportMonth_(req.month), admin.email));
}

function monthlyReportJob() {
  // Daily retry, monthly output: a failed first-of-month run is retried tomorrow.
  return withLock_(() => {
    const month = addDays_(today_().slice(0, 7) + '-01', -1).slice(0, 7);
    const p = PropertiesService.getScriptProperties();
    if (p.getProperty('monthly-report-complete') === month) return { skipped: true, month };
    const result = createMonthlyReport_(month, 'Scheduled report');
    p.setProperty('monthly-report-complete', month);
    return result;
  });
}

function createMonthlyReport_(month, actor) {
  const rows = readTable_('Bookings').filter((b) => b.date.slice(0, 7) === month)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const money = readTable_('Money').filter((m) => m.date.slice(0, 7) === month);
  const total = (type) => money.filter((m) => m.type === type).reduce((sum, m) => sum + Number(m.amount || 0), 0);
  const income = total('income'), expense = total('expense');
  const currency = (v) => 'INR ' + Number(v || 0).toFixed(2);
  const cell = (v) => '<td>' + esc_(String(v == null ? '' : v)) + '</td>';
  const table = (headers, body) => '<table><thead><tr>' + headers.map((h) => '<th>' + esc_(h) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table>';
  const html = '<!doctype html><html><head><meta charset="utf-8"><style>' +
    '@page{size:A4 landscape;margin:16mm}body{font:11px Arial;color:#182d2a}h1{font-size:24px}table{border-collapse:collapse;width:100%;margin:16px 0;table-layout:fixed}th,td{padding:7px;border:1px solid #ccd7d3;text-align:left;overflow-wrap:anywhere}th{background:#eaf1ed}tr{page-break-inside:avoid}thead{display:table-header-group}' +
    '</style></head><body><h1>' + esc_(settings_().venueName || 'Park Inn') + '</h1><h2>Monthly booking report: ' + month + '</h2>' +
    '<p>Private owner archive · Event dates in Asia/Kolkata · Generated ' + esc_(new Date().toISOString()) + '</p>' +
    '<p>Bookings: ' + rows.length + ' | Confirmed: ' + rows.filter((b) => b.status === 'confirmed').length +
    ' | Recorded income: ' + currency(income) + ' | Expenses: ' + currency(expense) + ' | Net cash flow: ' + currency(income - expense) + '</p>' +
    '<p>Bookings are grouped by event date; money is grouped by transaction date. Booking amounts are quoted values, not payments received. All booking statuses are included.</p>' +
    table(['ID / Date', 'Customer / Contact', 'Event / Slot', 'Guests', 'Status', 'Quoted amount', 'Notes'], rows.map((b) => '<tr>' +
      [b.id + ' / ' + b.date, b.name + ' / ' + b.mobile + ' / ' + b.email, (EVENT_TYPES[b.eventType] || b.eventType) + ' / ' + (SLOTS[b.slot] || {}).label,
       b.guests, b.status, currency(b.amount), [b.notes, b.adminNote].filter(Boolean).join(' | ')].map(cell).join('') + '</tr>').join('')) +
    (!rows.length ? '<p>No bookings in this month.</p>' : '') + '<h2>Income and expenses</h2>' +
    table(['Date', 'Type', 'Category', 'Amount', 'Booking ID', 'Description'], money.map((m) => '<tr>' +
      [m.date, m.type, m.category, currency(m.amount), m.bookingId, m.description].map(cell).join('') + '</tr>').join('')) + '</body></html>';
  const name = 'Park-Inn-Bookings-' + month + '.pdf';
  const folder = reportFolder_();
  const previous = folder.getFilesByName(name);
  const oldFiles = [];
  while (previous.hasNext()) oldFiles.push(previous.next());
  // Convert and save successfully before replacing the old archive.
  const blob = Utilities.newBlob(html, 'text/html', 'report.html').getAs('application/pdf').setName(name);
  const file = folder.createFile(blob);
  oldFiles.forEach((old) => old.setTrashed(true));
  PropertiesService.getScriptProperties().setProperty('last-monthly-report', month);
  log_(actor, 'Monthly PDF exported', month + ' · ' + rows.length + ' bookings');
  return { month, url: file.getUrl(), bookings: rows.length };
}

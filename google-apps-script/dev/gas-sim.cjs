'use strict';
/**
 * Node simulation of the Google Apps Script services used by ../Code.gs.
 * Not a Google product: behaviour is modelled on documented Apps Script semantics.
 */
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const RealDate = Date;
const CODE_PATH = path.join(__dirname, '..', 'Code.gs');
const DAY = 86400000;

function createGasContext(opts = {}) {
  const ownerEmail = String(opts.ownerEmail || 'owner@example.com').toLowerCase();

  /* ---------------- clock ---------------- */
  let fixed = opts.now === undefined || opts.now === null ? null : new RealDate(opts.now).getTime();
  const clock = {
    now: () => (fixed === null ? RealDate.now() : fixed),
    set(ms) { fixed = new RealDate(ms).getTime(); },
    advance(ms) { fixed = this.now() + ms; },
  };
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(clock.now());
      else super(...args);
    }
    static now() { return clock.now(); }
  }
  const D = (ms) => new FakeDate(ms);

  const logs = [];
  const fakeConsole = {
    log: (...a) => { logs.push(['log', a]); if (process.env.GAS_SIM_VERBOSE) console.log(...a); },
    error: (...a) => { logs.push(['error', a]); if (opts.printErrors || process.env.GAS_SIM_VERBOSE) console.error(...a); },
    warn: (...a) => { logs.push(['warn', a]); },
    info: (...a) => { logs.push(['info', a]); },
  };

  /* ---------------- Spreadsheet ---------------- */
  const isEmpty = (v) => v === undefined || v === null || v === '';
  class Range {
    constructor(sheet, row, col, nr, nc) { Object.assign(this, { sheet, row, col, nr, nc }); }
    getValues() {
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const r = this.sheet.rows[this.row - 1 + i] || [];
        const line = [];
        for (let j = 0; j < this.nc; j++) { const v = r[this.col - 1 + j]; line.push(v === undefined ? '' : v); }
        out.push(line);
      }
      return out;
    }
    getValue() { return this.getValues()[0][0]; }
    setValues(vals) {
      if (!Array.isArray(vals) || vals.length !== this.nr) throw new Error('The number of rows in the data does not match the number of rows in the range. The data has ' + (vals && vals.length) + ' but the range has ' + this.nr + '.');
      vals.forEach((line, i) => {
        if (!Array.isArray(line) || line.length !== this.nc) throw new Error('The number of columns in the data does not match the number of columns in the range. The data has ' + (line && line.length) + ' but the range has ' + this.nc + '.');
        line.forEach((v, j) => this.sheet._put(this.row + i, this.col + j, v));
      });
      return this;
    }
    setValue(v) { this.sheet._put(this.row, this.col, v); return this; }
    setNumberFormat(fmt) {
      for (let j = 0; j < this.nc; j++) this.sheet.formats.set(this.col + j, { startRow: this.row, fmt });
      return this;
    }
    setFontWeight() { return this; }
    setBackground() { return this; }
    setFontColor() { return this; }
  }

  class Sheet {
    constructor(name) { this.name = name; this.rows = []; this.formats = new Map(); this.maxRows = 1000; this.frozen = 0; this.widths = {}; }
    getName() { return this.name; }
    getMaxRows() { return this.maxRows; }
    getLastRow() {
      for (let i = this.rows.length - 1; i >= 0; i--) if (this.rows[i] && this.rows[i].some((v) => !isEmpty(v))) return i + 1;
      return 0;
    }
    getRange(row, col, nr = 1, nc = 1) {
      if (!(row >= 1) || !(col >= 1) || !(nr >= 1) || !(nc >= 1)) throw new Error('The coordinates or dimensions of the range are invalid.');
      return new Range(this, row, col, nr, nc);
    }
    appendRow(arr) {
      const row = this.getLastRow() + 1;
      if (row > this.maxRows) this.maxRows = row;
      arr.forEach((v, j) => this._put(row, j + 1, v));
      return this;
    }
    deleteRow(r) { return this.deleteRows(r, 1); }
    deleteRows(r, n = 1) {
      if (r < 1 || n < 1) throw new Error('Invalid row');
      this.rows.splice(r - 1, n);
      return this;
    }
    setFrozenRows(n) { this.frozen = n; }
    setColumnWidth(c, w) { this.widths[c] = w; }
    _put(row, col, v) {
      if (row > this.maxRows) this.maxRows = row;
      while (this.rows.length < row) this.rows.push([]);
      const r = this.rows[row - 1];
      while (r.length < col - 1) r.push(undefined);
      const f = this.formats.get(col);
      r[col - 1] = coerceCell(v, f && row >= f.startRow ? f.fmt : null);
    }
    /** test helper: all rows as plain arrays */
    dump() { return this.rows.slice(0, this.getLastRow()).map((r) => r.map((v) => (v === undefined ? '' : v))); }
  }

  function coerceCell(v, fmt) {
    if (v === undefined || v === null) return '';
    if (v instanceof RealDate || typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v !== 'string') return String(v);
    if (v.startsWith("'")) return v.slice(1); // leading apostrophe = literal text marker (modelled; see report)
    if (fmt === '@') return v;
    if (v.startsWith('=')) return { formula: v };
    return v;
  }

  const sheetsList = [new Sheet('Sheet1')];
  const spreadsheet = {
    timeZone: null,
    getSheetByName: (n) => sheetsList.find((s) => s.name === n) || null,
    insertSheet(n) {
      if (sheetsList.some((s) => s.name === n)) throw new Error('A sheet with the name "' + n + '" already exists.');
      const s = new Sheet(n); sheetsList.push(s); return s;
    },
    getOwner: () => ({ getEmail: () => ownerEmail }),
    getSheets: () => sheetsList.slice(),
    deleteSheet(s) {
      if (sheetsList.length <= 1) throw new Error('You can\'t delete all the visible sheets in a document.');
      sheetsList.splice(sheetsList.indexOf(s), 1);
    },
    getUrl: () => 'https://docs.google.com/spreadsheets/d/SIM_SPREADSHEET_ID/edit',
    setSpreadsheetTimeZone(tz) { this.timeZone = tz; },
  };
  const menus = [];
  const SpreadsheetApp = {
    getActiveSpreadsheet: () => spreadsheet,
    getUi: () => ({
      createMenu(title) {
        const m = { title, items: [] };
        const b = { addItem(label, fn) { m.items.push([label, fn]); return b; }, addToUi() { menus.push(m); } };
        return b;
      },
    }),
  };

  /* ---------------- Calendar ---------------- */
  let evSeq = 0;
  class CalEvent {
    constructor(cal, title, start, end, desc, allDay) {
      Object.assign(this, { cal, id: 'evt' + (++evSeq) + '@sim', title, desc: desc || '', start, end, allDay: !!allDay, tags: {}, deleted: false });
    }
    getId() { return this.id; }
    getTitle() { return this.title; }
    setTitle(t) { this.title = t; return this; }
    setDescription(d) { this.desc = d; return this; }
    getDescription() { return this.desc; }
    setTime(s, e) { this.start = +s; this.end = +e; this.allDay = false; return this; }
    getStartTime() { return D(this.start); }
    getEndTime() { return D(this.end); }
    isAllDayEvent() { return this.allDay; }
    getAllDayStartDate() { if (!this.allDay) throw new Error('Event is not an all-day event.'); return D(this.start); }
    getAllDayEndDate() { if (!this.allDay) throw new Error('Event is not an all-day event.'); return D(this.end); }
    setTag(k, v) { this.tags[k] = String(v); return this; }
    getTag(k) { return Object.prototype.hasOwnProperty.call(this.tags, k) ? this.tags[k] : null; }
    deleteEvent() { this.deleted = true; }
  }
  const calendars = new Map();
  class Calendar {
    constructor(name, o) { this.name = name; this.opts = o || {}; this.id = 'cal' + (calendars.size + 1) + '@group.calendar.google.com'; this.events = []; calendars.set(this.id, this); }
    getId() { return this.id; }
    getName() { return this.name; }
    createEvent(title, start, end, o) {
      if (!(+end >= +start)) throw new Error('The end time must be after the start time.');
      const ev = new CalEvent(this, title, +start, +end, o && o.description, false);
      this.events.push(ev); return ev;
    }
    getEvents(start, end) {
      return this.events.filter((e) => !e.deleted && e.start < +end && e.end > +start);
    }
    // Like real Google: deleted events are still returned by id.
    getEventById(id) { return this.events.find((e) => e.id === id) || null; }
  }
  const CalendarApp = {
    Color: { YELLOW: '#ffd700' },
    createCalendar: (name, o) => new Calendar(name, o),
    getCalendarById: (id) => calendars.get(id) || null,
  };

  /* ---------------- Properties / Cache / Lock ---------------- */
  const props = new Map();
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => (props.has(k) ? props.get(k) : null),
      setProperty(k, v) { props.set(k, String(v)); },
      deleteProperty(k) { props.delete(k); },
    }),
  };
  const cacheStore = new Map();
  const CacheService = {
    getScriptCache: () => ({
      get(k) {
        const e = cacheStore.get(k);
        if (!e) return null;
        if (e.exp <= clock.now()) { cacheStore.delete(k); return null; }
        return e.value;
      },
      put(k, v, ttl) {
        if (typeof v !== 'string') throw new Error('Cache values must be strings');
        cacheStore.set(k, { value: v, exp: clock.now() + Math.min(ttl === undefined ? 600 : ttl, 21600) * 1000 });
      },
      remove(k) { cacheStore.delete(k); },
    }),
  };
  const lockState = { held: false, available: true };
  const LockService = {
    getScriptLock: () => ({
      tryLock() { if (!lockState.available || lockState.held) return false; lockState.held = true; return true; },
      releaseLock() { lockState.held = false; },
    }),
  };

  /* ---------------- Mail ---------------- */
  const outbox = [];
  const mail = { failNext: false, quotaOverride: null };
  const MailApp = {
    sendEmail(msg) {
      if (typeof msg !== 'object' || !msg.to) throw new Error('Invalid argument: to');
      if (mail.failNext) { mail.failNext = false; throw new Error('Service invoked too many times or invalid email'); }
      outbox.push({ to: msg.to, subject: msg.subject, htmlBody: msg.htmlBody, name: msg.name, at: clock.now() });
    },
    getRemainingDailyQuota() {
      if (mail.quotaOverride !== null) return mail.quotaOverride;
      const day = new RealDate(clock.now()).toISOString().slice(0, 10);
      return 100 - outbox.filter((m) => new RealDate(m.at).toISOString().slice(0, 10) === day).length;
    },
  };

  /* ---------------- Session / Script / Content ---------------- */
  const Session = { getEffectiveUser: () => ({ getEmail: () => ownerEmail }) };
  const triggers = [];
  const ScriptApp = {
    getProjectTriggers: () => triggers.slice(),
    deleteTrigger(t) { triggers.splice(triggers.indexOf(t), 1); },
    newTrigger(fn) {
      const t = { fn, hours: null };
      const b = {
        timeBased() { return b; },
        everyHours(n) { t.hours = n; return b; },
        everyMinutes(n) { t.minutes = n; return b; },
        everyDays(n) { t.days = n; return b; },
        atHour(n) { t.atHour = n; return b; },
        inTimezone(tz) { t.timeZone = tz; return b; },
        create() { const tr = { getHandlerFunction: () => fn, ...t }; triggers.push(tr); return tr; },
      };
      return b;
    },
  };
  const ContentService = {
    MimeType: { JSON: 'JSON', TEXT: 'TEXT' },
    createTextOutput(s) {
      const o = { content: s, mime: 'TEXT', getContent: () => o.content, getMimeType: () => o.mime, setMimeType(m) { o.mime = m; return o; } };
      return o;
    },
  };

  /* ---------------- Utilities ---------------- */
  const toBuf = (x) => (typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(Array.from(x, (b) => b & 255)));
  const signed = (buf) => Array.from(buf, (b) => (b > 127 ? b - 256 : b));
  const Utilities = {
    Charset: { UTF_8: 'UTF_8' },
    getUuid: () => crypto.randomUUID(),
    computeHmacSha256Signature: (value, key) => signed(crypto.createHmac('sha256', toBuf(key)).update(toBuf(value)).digest()),
    base64EncodeWebSafe: (x) => toBuf(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    base64DecodeWebSafe: (s) => signed(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
    newBlob: (bytes) => ({ getDataAsString: () => toBuf(bytes).toString('utf8'), getAs: (mime) => ({ html: bytes, mime, setName(name) { this.name = name; return this; } }) }),
    formatDate(date, tz, pattern) {
      const dt = new RealDate(+date);
      const p = {};
      new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
        .formatToParts(dt).forEach((x) => { p[x.type] = x.value; });
      const mon = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short' }).format(dt);
      return pattern.replace(/yyyy|yy|MMM|MM|EEE|dd|d/g, (t) => ({
        yyyy: p.year, yy: p.year.slice(-2), MMM: mon, MM: p.month, EEE: p.weekday, dd: p.day, d: String(Number(p.day)),
      }[t]));
    },
  };

  const driveFiles = [];
  const folders = new Map();
  const DriveApp = {
    getFolderById(id) { if (!folders.has(id)) throw new Error('Folder missing'); return folders.get(id); },
    createFolder(name) {
      const id = crypto.randomUUID();
      const folder = { getId: () => id, isTrashed: () => false,
        getFilesByName(name) { const matches = driveFiles.filter(f => f.name === name && !f.trashed); return { hasNext: () => matches.length > 0, next: () => matches.shift() }; },
        createFile(blob) { const file = { ...blob, trashed: false, getUrl: () => 'https://drive.google.com/file/d/' + crypto.randomUUID(), setTrashed(v) { this.trashed = v; } }; driveFiles.push(file); return file; },
      };
      folders.set(id, folder); return folder;
    },
  };
  /* ---------------- load Code.gs ---------------- */
  const sandbox = {
    Date: FakeDate, console: fakeConsole, SpreadsheetApp, CalendarApp, PropertiesService, CacheService,
    LockService, MailApp, Session, ScriptApp, ContentService, Utilities, DriveApp,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(CODE_PATH, 'utf8'), context, { filename: 'Code.gs' });

  const parse = (out) => JSON.parse(out.getContent());
  const calHelpers = {
    get() { const id = context.settings_().calendarId; return id ? calendars.get(id) : null; },
    all: () => Array.from(calendars.values()),
    /** Admin adds an all-day event (e.g. a private booking) straight in Google Calendar. */
    addExternalAllDay(day, title = 'Private function', days = 1) {
      const cal = calHelpers.get();
      const start = RealDate.parse(day + 'T00:00:00+05:30');
      const ev = new CalEvent(cal, title, start, start + days * DAY, '', true);
      cal.events.push(ev); return ev;
    },
    addExternalTimed(startMs, endMs, title = 'External event') {
      const cal = calHelpers.get();
      const ev = new CalEvent(cal, title, startMs, endMs, '', false);
      cal.events.push(ev); return ev;
    },
    /** Delete directly in Google Calendar. */
    deleteDirect(id) { cal().getEventById(id).deleted = true; },
    /** Move directly in Google Calendar. */
    move(id, startMs, endMs) { const e = cal().getEventById(id); e.start = startMs; e.end = endMs; },
    forBooking: (bookingId) => (calHelpers.get() ? calHelpers.get().events.filter((e) => !e.deleted && e.getTag('bookingId') === bookingId) : []),
  };
  const cal = () => calHelpers.get();

  return {
    context, driveFiles, clock, outbox, mail, logs, props, cacheStore, triggers, menus, lockState,
    calendar: calHelpers,
    sheets: {
      get: (n) => spreadsheet.getSheetByName(n),
      names: () => sheetsList.map((s) => s.name),
      dump: (n) => spreadsheet.getSheetByName(n).dump(),
    },
    call(action, payload) { return parse(context.doPost({ postData: { contents: JSON.stringify(Object.assign({ action }, payload || {})) } })); },
    rawPost(contents) { return parse(context.doPost({ postData: { contents } })); },
    get(action) { return parse(context.doGet({ parameter: action === undefined ? {} : { action } })); },
    runSetup() { return context.setup(); },
    spreadsheet,
  };
}

module.exports = { createGasContext };

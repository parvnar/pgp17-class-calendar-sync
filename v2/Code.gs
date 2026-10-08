/**
 * PGP17 Term II – class calendar sync, version 2.
 *
 * What it does every hour:
 *   1. Reads the batch timetable sheet (all five sections).
 *   2. Reads the Session Details sheet (topic, book chapter, case, reading per session)
 *      and, every few hours, matches the Materials tab to files in the Term 2 Drive folder.
 *   3. Keeps one Google Calendar per section ("PGP17 Term II – Section A" … "E") in step:
 *      adds new classes, moves/edits changed ones, removes cancelled ones.
 *
 * First-time setup: fill in CONFIG.detailsSpreadsheetId, then run setupV2() once.
 * See SETUP.md for the full steps.
 */
const CONFIG = {
  timetableSpreadsheetId: '1En591R2sVtII-zUMriVSKB0Pi7ZtLQxLbNDtS_OcGpQ',
  timetableSheetName: 'PGP17 Term -II PrMT',

  // The Google Sheet made from PGP17_Term2_Session_Details.xlsx (the long ID in its URL).
  detailsSpreadsheetId: 'PASTE_SESSION_DETAILS_SHEET_ID_HERE',

  // "Term 2" materials folder on Drive.
  materialsFolderId: 'PASTE_MATERIALS_FOLDER_ID_HERE',

  timeZone: 'Asia/Kolkata',
  firstDate: '2026-10-01',
  lastDateExclusive: '2026-11-22',   // includes the 17–21 November exam week

  sections: ['A', 'B', 'C', 'D', 'E'],
  calendarName: function (section) { return 'PGP17 Term II – Section ' + section; },

  // Share each section calendar (read-only, full details) with everyone in your institute domain.
  shareWithDomain: true,

  // How often (hours) to re-scan the Drive folder for material links.
  relinkEveryHours: 3,

  // Leave room under Apps Script's 6-minute limit; unfinished work continues 1 minute later.
  maxRunMillis: 4.5 * 60 * 1000,

  // Version 1 tags (the original Section E script and the shared A–E script),
  // used once to remove old v1 events from the main calendar.
  v1EventTags: ['pgp17PrMT2ScheduleSlot', 'pgp17PrMT2SectionESlot']
};

const CREATOR_CREDIT = '\u00A9 Parv Nar';

// Timetable course codes that are spelt differently elsewhere.
const COURSE_ALIASES = { IKS: 'IK', MCOM: 'MCOMM', QM2: 'QMII', MM2: 'MMII' };

// Google Calendar event colour IDs (same colours as version 1).
const COURSE_COLORS = {
  MANAC: '9', DA: '7', MEB: '2', QMII: '6', MMII: '3',
  MCOMM: '4', WIPS: '5', IK: '8', ODD: '10', FLP: '11'
};

const PROP = PropertiesService.getScriptProperties();
const EVENT_MARK = 'pgp17v2';

/* ===================================================================== */
/*  Entry points                                                          */
/* ===================================================================== */

/** Run once. Creates and shares the calendars, removes v1 events, links materials, starts the hourly trigger. */
function setupV2() {
  requireDetailsSheet_();
  const domain = userDomain_();
  const calendars = ensureCalendars_(domain);
  removeVersion1_();
  linkMaterials_(true);
  writeCalendarLinks_(calendars, domain);

  ScriptApp.getProjectTriggers().forEach(function (t) {
    const fn = t.getHandlerFunction();
    if (fn === 'syncAllSections' || fn === 'syncSectionESchedule') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncAllSections').timeBased().everyHours(1).create();
  console.log('Hourly trigger created.');

  syncAllSections();
}

/** The hourly job. */
function syncAllSections() {
  run_(false);
}

/** Dry run: logs what would change, touches nothing. */
function previewAllSections() {
  run_(true);
}

/** Remove upcoming v1 events from your main calendar (safe to run again). */
function removeOldV1Events() {
  removeVersion1_();
}

/** Re-scan the Drive folder for material links right now. */
function relinkMaterialsNow() {
  linkMaterials_(true);
}

/** Print the add-to-calendar links again (also in the "Calendar Links" tab). */
function showCalendarLinks() {
  const domain = userDomain_();
  writeCalendarLinks_(ensureCalendars_(domain), domain);
}

/* ===================================================================== */
/*  Main sync                                                             */
/* ===================================================================== */

function run_(previewOnly) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    console.log('Another sync is already running; skipping this one.');
    return;
  }
  const startedAt = Date.now();
  try {
    clearContinuation_();

    // 1. Read and validate the timetable before touching anything.
    const timetable = SpreadsheetApp.openById(CONFIG.timetableSpreadsheetId);
    const sheet = timetable.getSheetByName(CONFIG.timetableSheetName);
    if (!sheet) throw new Error('Timetable tab not found: ' + CONFIG.timetableSheetName);
    const plan = buildPlan_(sheet.getDataRange().getValues(), timetable.getSpreadsheetTimeZone());
    if (plan.firstSyncDate >= CONFIG.lastDateExclusive) {
      console.log('No upcoming dates left to sync.');
      return;
    }

    // 2. Session details (and a periodic Drive re-scan).
    requireDetailsSheet_();
    if (!previewOnly) linkMaterials_(false);
    const details = loadDetails_();

    // 3. Calendars.
    const calendars = previewOnly ? existingCalendars_() : ensureCalendars_(userDomain_());
    const timeMin = isoAt_(plan.firstSyncDate, '00:00');
    const timeMax = isoAt_(CONFIG.lastDateExclusive, '00:00');
    const totals = {};

    for (let i = 0; i < CONFIG.sections.length; i++) {
      const section = CONFIG.sections[i];
      const wanted = {};
      plan.sessions[section].forEach(function (s) {
        wanted[s.key] = buildEvent_(s, plan, details);
      });
      const counts = syncSection_(section, calendars[section], wanted, timeMin, timeMax,
        previewOnly, startedAt);
      totals[section] = counts;
      if (counts.incomplete) {
        if (!previewOnly) scheduleContinuation_();
        console.log('Time budget used up at Section ' + section + '; continuing in 1 minute.');
        break;
      }
    }

    const summary = (previewOnly ? 'PREVIEW ' : 'SYNC ') + JSON.stringify(totals);
    console.log(summary);
    plan.warnings.forEach(function (w) { console.warn(w); });
    if (!previewOnly) writeStatus_(summary, plan.warnings);
  } finally {
    lock.releaseLock();
  }
}

function syncSection_(section, calendarId, wanted, timeMin, timeMax, previewOnly, startedAt) {
  const counts = { added: 0, updated: 0, removed: 0, unchanged: 0 };
  const existing = {};
  if (calendarId) {
    listTaggedEvents_(calendarId, timeMin, timeMax).forEach(function (ev) {
      const key = ev.extendedProperties.private.key;
      (existing[key] = existing[key] || []).push(ev);
    });
  }
  const overBudget = function () { return Date.now() - startedAt > CONFIG.maxRunMillis; };

  const keys = Object.keys(wanted).sort();
  for (let i = 0; i < keys.length; i++) {
    if (overBudget()) { counts.incomplete = true; return counts; }
    const key = keys[i];
    const want = wanted[key];
    const matches = existing[key] || [];
    const current = matches.shift();

    if (!current) {
      log_(previewOnly, 'ADD', section, key, want.summary);
      if (!previewOnly) withRetry_(function () { Calendar.Events.insert(want, calendarId); }, 'add ' + key);
      counts.added++;
    } else if (current.extendedProperties.private.h !== want.extendedProperties.private.h) {
      log_(previewOnly, 'UPDATE', section, key, want.summary);
      if (!previewOnly) withRetry_(function () { Calendar.Events.update(want, calendarId, current.id); }, 'update ' + key);
      counts.updated++;
    } else {
      counts.unchanged++;
    }
    matches.forEach(function (dup) {
      log_(previewOnly, 'REMOVE DUPLICATE', section, key, dup.summary);
      if (!previewOnly) deleteEvent_(calendarId, dup.id);
      counts.removed++;
    });
    delete existing[key];
  }

  // Anything left is a class that was cancelled or moved away.
  const leftovers = Object.keys(existing);
  for (let i = 0; i < leftovers.length; i++) {
    const evs = existing[leftovers[i]];
    for (let j = 0; j < evs.length; j++) {
      if (overBudget()) { counts.incomplete = true; return counts; }
      log_(previewOnly, 'REMOVE', section, leftovers[i], evs[j].summary);
      if (!previewOnly) deleteEvent_(calendarId, evs[j].id);
      counts.removed++;
    }
  }
  return counts;
}

/* ===================================================================== */
/*  Timetable parsing                                                     */
/* ===================================================================== */

function buildPlan_(data, sheetTimeZone) {
  if (data.length < 3 || String(data[1][1]).trim().toLowerCase() !== 'sections') {
    throw new Error('The timetable layout has changed: cell B2 must say "Sections". No calendar changes were made.');
  }
  const header = data[1].map(function (h) { return String(h || '').trim(); });
  const findCol = function (re, fallback) {
    for (let c = 0; c < header.length; c++) if (re.test(header[c])) return c;
    return fallback;
  };
  const courseCol = findCol(/^course$/i, 8);
  const facultyNameCol = findCol(/name of the faculty/i, 10);
  const facultyCodeCol = findCol(/abbr?e?v/i, 11);

  // Class columns: everything between "Sections" and the course table.
  // A column whose header has a time range is a slot; any other non-lunch column
  // (e.g. the unlabelled one used for extra sessions) only counts cells that carry their own time.
  const columns = [];
  for (let c = 2; c < courseCol; c++) {
    if (/lunch/i.test(header[c])) continue;
    const t = findTimeRange_(header[c]);
    columns.push({ index: c, start: t ? t.start : null, end: t ? t.end : null });
  }

  const courseNames = {};
  const facultyNames = {};
  data.forEach(function (row) {
    const course = String(row[courseCol] || '').trim();
    const m = course.match(/^(.+?)\s*\(([^)]+)\)/);
    if (m) courseNames[normCourse_(m[2])] = m[1].trim();
    const code = String(row[facultyCodeCol] || '').trim().toUpperCase();
    const name = String(row[facultyNameCol] || '').trim();
    if (code && name) facultyNames[code] = name;
  });

  // Room per section from row 1, e.g. "Section E : LR 03".
  const rooms = {};
  data[0].forEach(function (cell) {
    const m = String(cell || '').match(/Section\s+([A-Z])\s*:\s*(.+)$/i);
    if (m) rooms[m[1].toUpperCase()] = m[2].trim();
  });

  const today = Utilities.formatDate(new Date(), CONFIG.timeZone, 'yyyy-MM-dd');
  const firstSyncDate = today > CONFIG.firstDate ? today : CONFIG.firstDate;
  const sessions = {};
  const rowCounts = {};
  const seenDates = {};
  const warnings = [];
  CONFIG.sections.forEach(function (s) { sessions[s] = []; rowCounts[s] = 0; seenDates[s] = {}; });

  let currentDate = null;
  let datedRows = 0;

  for (let r = 2; r < data.length; r++) {
    const row = data[r];
    if (row[0] instanceof Date && !isNaN(row[0].getTime())) {
      currentDate = Utilities.formatDate(row[0], sheetTimeZone, 'yyyy-MM-dd');
      datedRows++;
    }
    const section = String(row[1] || '').trim().toUpperCase();
    if (!sessions[section]) continue;
    if (!currentDate) throw new Error('Section ' + section + ' row ' + (r + 1) + ' has no date above it.');
    if (seenDates[section][currentDate]) {
      throw new Error('Two Section ' + section + ' rows on ' + currentDate + ' (row ' + (r + 1) + '). No calendar changes were made.');
    }
    seenDates[section][currentDate] = true;
    rowCounts[section]++;
    if (currentDate < firstSyncDate || currentDate >= CONFIG.lastDateExclusive) continue;

    const usedKeys = {};
    columns.forEach(function (col) {
      const raw = String(row[col.index] || '');
      raw.split(/\n+/).forEach(function (line) {
        const text = line.replace(/\s+/g, ' ').trim();
        if (!text || text === '-') return;
        const parsed = parseClassCell_(text);
        if (!parsed) {
          if (/\d/.test(text)) warnings.push('Skipped unreadable cell on ' + currentDate + ' Section ' + section + ': "' + text + '"');
          return;
        }
        const start = parsed.start || col.start;
        const end = parsed.end || col.end;
        if (!start || !end) {
          warnings.push('No time for "' + text + '" on ' + currentDate + ' Section ' + section + ' – add (HH:MM-HH:MM) to the cell.');
          return;
        }
        let key = section + '|' + currentDate + '|' + parsed.courseKey + '|' + parsed.session;
        if (usedKeys[key]) key += '#' + (++usedKeys[key]); else usedKeys[key] = 1;
        sessions[section].push({
          key: key, section: section, date: currentDate, start: start, end: end,
          cell: text, courseLabel: parsed.courseLabel, courseKey: parsed.courseKey,
          session: parsed.session, faculty: parsed.faculty
        });
      });
    });
  }

  // Stop rather than wipe calendars if the sheet came back broken or half-loaded.
  const thin = CONFIG.sections.filter(function (s) { return rowCounts[s] < 15; });
  if (datedRows < 20 || thin.length) {
    throw new Error('The timetable looks incomplete (' + datedRows + ' dates; thin sections: ' +
      (thin.join(', ') || 'none') + '). No calendar changes were made.');
  }

  return {
    firstSyncDate: firstSyncDate, sessions: sessions, warnings: warnings,
    courseNames: courseNames, facultyNames: facultyNames, rooms: rooms
  };
}

/** "MEB 3(DB)", "Mcomm 1 (DS) (16:05-17:20)", "QM II 2 (UN)" → parts, or null if not a class. */
function parseClassCell_(text) {
  let rest = text;
  let start = null, end = null;
  const t = findTimeRange_(rest);
  if (t) {
    start = t.start; end = t.end;
    rest = rest.replace(t.match, ' ').replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const m = rest.match(/^([A-Za-z][A-Za-z .&\-]{0,20}?)\s*(\d{1,2})\s*(?:\(\s*([^()]*?)\s*\))?\s*$/);
  if (!m) return null;
  return {
    courseLabel: m[1].trim().replace(/\s+/g, ' '),
    courseKey: normCourse_(m[1]),
    session: parseInt(m[2], 10),
    faculty: (m[3] || '').trim().toUpperCase(),
    start: start, end: end
  };
}

function findTimeRange_(text) {
  const m = String(text || '').match(/(\d{1,2})[:.](\d{2})\s*(?:-|–|—|to)\s*(\d{1,2})[:.](\d{2})/i);
  if (!m) return null;
  const fix = function (h, min) {
    let hour = parseInt(h, 10);
    if (hour < 8) hour += 12;   // "4:05" in a class cell means 16:05
    return ('0' + hour).slice(-2) + ':' + min;
  };
  return { match: m[0], start: fix(m[1], m[2]), end: fix(m[3], m[4]) };
}

function normCourse_(code) {
  const k = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return COURSE_ALIASES[k] || k;
}

/* ===================================================================== */
/*  Session details + event content                                       */
/* ===================================================================== */

function loadDetails_() {
  const ss = SpreadsheetApp.openById(CONFIG.detailsSpreadsheetId);
  const sessions = {};
  readTable_(ss, 'Sessions').forEach(function (r) {
    const course = normCourse_(r['subject']);
    const n = parseInt(r['session'], 10);
    if (!course || !n) return;
    const fac = String(r['faculty (optional)'] || r['faculty'] || '').trim().toUpperCase();
    sessions[course + '|' + fac + '|' + n] = {
      topic: str_(r['topic']), book: str_(r['book & chapter']),
      cases: str_(r['case']), readings: str_(r['reading']), notes: str_(r['notes'])
    };
  });
  const materials = {};
  readTable_(ss, 'Materials').forEach(function (r) {
    const course = normCourse_(r['subject']);
    const code = str_(r['code']).toUpperCase();
    if (!course || !code) return;
    materials[course + '|' + code] = { title: str_(r['title']), link: str_(r['link']) };
  });
  let folders = {};
  try { folders = JSON.parse(PROP.getProperty('subjectFolders') || '{}'); } catch (e) { folders = {}; }
  return { sessions: sessions, materials: materials, folders: folders };
}

function buildEvent_(s, plan, details) {
  const d = details.sessions[s.courseKey + '|' + s.faculty + '|' + s.session] ||
            details.sessions[s.courseKey + '||' + s.session] || null;
  const courseName = plan.courseNames[s.courseKey] || s.courseLabel;
  const facultyName = plan.facultyNames[s.faculty] || s.faculty || 'Faculty not listed';
  const room = plan.rooms[s.section] || '';

  let summary = s.courseLabel + ' ' + s.session + (s.faculty ? ' (' + s.faculty + ')' : '');
  const short = d ? shortTopic_(d.topic) : '';
  if (short) summary += ' · ' + short;

  const html = [];
  html.push('<b>' + esc_(courseName) + '</b> · Session ' + s.session + ' · ' + esc_(facultyName));
  if (room) html.push('Room: ' + esc_(room));
  if (d) {
    if (d.topic) html.push('', '<b>Topic</b>', esc_(d.topic));
    if (d.book) html.push('', '<b>Book / chapters</b>', esc_(d.book));
    const caseHtml = itemsHtml_(s.courseKey, d.cases, details.materials);
    if (caseHtml) html.push('', '<b>Case to prepare</b>', caseHtml);
    const readHtml = itemsHtml_(s.courseKey, d.readings, details.materials);
    if (readHtml) html.push('', '<b>Reading</b>', readHtml);
    if (d.notes) html.push('', '<b>Notes</b>', esc_(d.notes));
  } else {
    html.push('', '<i>Prep details for this session have not been added yet.</i>');
  }
  const folder = details.folders[s.courseKey];
  if (folder) html.push('', '<a href="' + esc_(folder) + '">📁 All ' + esc_(s.courseLabel) + ' material</a>');
  html.push('', '<small>Timetable cell: ' + esc_(s.cell) + ' · auto-updated hourly · ' + CREATOR_CREDIT + '</small>');
  const description = html.join('<br>');

  const event = {
    summary: summary,
    location: room,
    description: description,
    start: { dateTime: s.date + 'T' + s.start + ':00', timeZone: CONFIG.timeZone },
    end: { dateTime: s.date + 'T' + s.end + ':00', timeZone: CONFIG.timeZone },
    colorId: COURSE_COLORS[s.courseKey] || '8',
    reminders: { useDefault: true },
    extendedProperties: { private: {} }
  };
  event.extendedProperties.private[EVENT_MARK] = '1';
  event.extendedProperties.private.key = s.key;
  event.extendedProperties.private.h = hash_([summary, room, description,
    event.start.dateTime, event.end.dateTime, event.colorId].join('\u0001'));
  return event;
}

/** Turns "C4: Gulf Real Estate\nC5: …" into bullet lines with Drive links where known. */
function itemsHtml_(courseKey, text, materials) {
  if (!text) return '';
  return text.split(/\n+|;\s*(?=(?:C|R|TN|SIM|X)\d+\s*:)/).map(function (item) {
    item = item.trim();
    if (!item) return null;
    const m = item.match(/^\[?\s*((?:C|R|TN|SIM|X)\d+)\b\s*:?\s*(.*)$/i);
    if (!m) return '• ' + esc_(item);
    const code = m[1].toUpperCase();
    const mat = materials[courseKey + '|' + code];
    let label = item;
    // "R1 (continues)" → "R1: <title> (continues)"
    if (mat && mat.title && (!m[2] || m[2].charAt(0) === '(')) {
      label = code + ': ' + mat.title + (m[2] ? ' ' + m[2] : '');
    }
    if (mat && mat.link) return '• <a href="' + esc_(mat.link) + '">' + esc_(label) + '</a>';
    return '• ' + esc_(label) + ' <i>(file not on Drive yet)</i>';
  }).filter(Boolean).join('<br>');
}

function shortTopic_(topic) {
  if (!topic) return '';
  let t = topic.split(/[:;.,]|\s[–—-]\s/)[0].trim();
  if (t.length > 45) t = t.slice(0, 45).replace(/\s+\S*$/, '') + '…';
  return t;
}

/* ===================================================================== */
/*  Calendars, sharing, links                                             */
/* ===================================================================== */

function ensureCalendars_(domain) {
  const out = {};
  CONFIG.sections.forEach(function (section) {
    const prop = 'calendar_' + section;
    let id = PROP.getProperty(prop);
    if (id) {
      try { Calendar.Calendars.get(id); } catch (e) { id = null; }
    }
    if (!id) {
      const cal = withRetry_(function () {
        return Calendar.Calendars.insert({
          summary: CONFIG.calendarName(section),
          description: 'PGP17 Term II classes for Section ' + section +
            ' with topic, case and reading for each session. Updated automatically every hour from the batch timetable.',
          timeZone: CONFIG.timeZone
        });
      }, 'create calendar ' + section);
      id = cal.id;
      PROP.setProperty(prop, id);
      console.log('Created calendar for Section ' + section + ': ' + id);
    }
    if (CONFIG.shareWithDomain && domain && PROP.getProperty('shared_' + section) !== domain) {
      try {
        const acl = Calendar.Acl.list(id).items || [];
        const has = acl.some(function (a) { return a.scope && a.scope.type === 'domain' && a.scope.value === domain; });
        if (!has) {
          Calendar.Acl.insert({ role: 'reader', scope: { type: 'domain', value: domain } }, id);
        }
        PROP.setProperty('shared_' + section, domain);
        console.log('Section ' + section + ' calendar shared with ' + domain + '.');
      } catch (e) {
        console.warn('Could not share Section ' + section + ' calendar with ' + domain + ': ' + e.message);
      }
    }
    out[section] = id;
  });
  return out;
}

function existingCalendars_() {
  const out = {};
  CONFIG.sections.forEach(function (s) { out[s] = PROP.getProperty('calendar_' + s); });
  return out;
}

function addLink_(calendarId) {
  // Same format as Google Calendar's own "share" link.
  return 'https://calendar.google.com/calendar/u/0?cid=' + Utilities.base64Encode(calendarId).replace(/=+$/, '');
}

function writeCalendarLinks_(calendars, domain) {
  const ss = SpreadsheetApp.openById(CONFIG.detailsSpreadsheetId);
  const sh = ss.getSheetByName('Calendar Links') || ss.insertSheet('Calendar Links');
  sh.getRange(1, 1, 6, 5).clearContent();
  const rows = [['Section', 'Calendar', 'Add-to-calendar link', 'Calendar ID', 'Shared with']];
  CONFIG.sections.forEach(function (s) {
    rows.push([s, CONFIG.calendarName(s), addLink_(calendars[s]), calendars[s],
      PROP.getProperty('shared_' + s) ? 'Everyone at ' + domain : 'NOT shared – see log']);
    console.log('Section ' + s + ': ' + addLink_(calendars[s]));
  });
  sh.getRange(1, 1, rows.length, 5).setValues(rows);
  sh.getRange(1, 1, 1, 5).setFontWeight('bold');
  sh.setColumnWidth(3, 420);
  sh.setColumnWidth(4, 360);
}

function writeStatus_(summary, warnings) {
  const ss = SpreadsheetApp.openById(CONFIG.detailsSpreadsheetId);
  const sh = ss.getSheetByName('Calendar Links') || ss.insertSheet('Calendar Links');
  const now = Utilities.formatDate(new Date(), CONFIG.timeZone, 'dd MMM yyyy, HH:mm');
  sh.getRange(8, 1, 3, 2).setValues([
    ['Last sync', now],
    ['Result', summary],
    ['Warnings', warnings.length ? warnings.join('\n') : 'none']
  ]);
  sh.getRange(8, 1, 3, 1).setFontWeight('bold');
}

function userDomain_() {
  const email = Session.getEffectiveUser().getEmail() || '';
  const domain = email.split('@')[1] || '';
  if (/^(gmail|googlemail)\.com$/i.test(domain)) {
    throw new Error('This script must run from your institute Google account, not ' + email + '.');
  }
  return domain;
}

/* ===================================================================== */
/*  Drive material linking                                                */
/* ===================================================================== */

const STOP_WORDS = ('the a an and of for to in on at by with from is are its it how what why when ' +
  'case study note technical reading harvard hbs hbsp hbr iima iim ahmedabad ivey pdf eng ' +
  'continued per toc available').split(' ').reduce(function (o, w) { o[w] = true; return o; }, {});

function linkMaterials_(force) {
  const last = Number(PROP.getProperty('lastRelink') || 0);
  if (!force && Date.now() - last < CONFIG.relinkEveryHours * 3600 * 1000) return;
  if (!CONFIG.materialsFolderId) return;

  const files = [];
  const subjectFolders = {};
  const ss = SpreadsheetApp.openById(CONFIG.detailsSpreadsheetId);
  const matSheet = ss.getSheetByName('Materials');
  if (!matSheet) throw new Error('Session Details sheet has no "Materials" tab.');
  const matData = matSheet.getDataRange().getValues();
  const head = matData[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const col = function (name) { return head.indexOf(name); };
  const cSubj = col('subject'), cCode = col('code'), cTitle = col('title'),
        cLink = col('link'), cSrc = col('link source'), cFile = col('matched file');
  const subjectKeys = {};
  for (let r = 1; r < matData.length; r++) {
    const k = normCourse_(matData[r][cSubj]);
    if (k) subjectKeys[k] = true;
  }

  // Walk the Drive folder.
  let root;
  try {
    root = DriveApp.getFolderById(CONFIG.materialsFolderId);
  } catch (e) {
    console.warn('Cannot open the materials folder: ' + e.message);
    return;
  }
  const walk = function (folder, path, subjectsOnPath, depth) {
    if (depth > 6 || files.length > 3000) return;
    const fit = folder.getFiles();
    while (fit.hasNext()) {
      const f = fit.next();
      if (f.isTrashed()) continue;   // a replaced/deleted copy must never win the match
      files.push({ name: f.getName(), url: f.getUrl(), path: path, subjects: subjectsOnPath });
    }
    const dit = folder.getFolders();
    while (dit.hasNext()) {
      const sub = dit.next();
      const found = subjectsInName_(sub.getName(), subjectKeys);
      found.forEach(function (k) { if (!subjectFolders[k]) subjectFolders[k] = sub.getUrl(); });
      walk(sub, path.concat(sub.getName()), subjectsOnPath.concat(found), depth + 1);
    }
  };
  walk(root, [], [], 0);
  PROP.setProperty('subjectFolders', JSON.stringify(subjectFolders));

  // Match each material that has no manual link.
  const matchedTo = {};
  let linked = 0;
  for (let r = 1; r < matData.length; r++) {
    const row = matData[r];
    const link = String(row[cLink] || '').trim();
    const src = String(row[cSrc] || '').trim().toLowerCase();
    if (link && src !== 'auto') continue;   // manual link – never touch
    const subject = normCourse_(row[cSubj]);
    const code = String(row[cCode] || '').trim().toUpperCase();
    const best = bestFile_(subject, code, String(row[cTitle] || ''), files);
    if (best) {
      row[cLink] = best.url;
      row[cSrc] = 'auto';
      row[cFile] = best.path.concat(best.name).join(' / ');
      matchedTo[best.url] = (matchedTo[best.url] ? matchedTo[best.url] + ', ' : '') + subject + ' ' + code;
      linked++;
    }
  }
  matSheet.getRange(1, 1, matData.length, matData[0].length).setValues(matData);

  // Drive Index tab, so unmatched files are easy to spot.
  const idx = ss.getSheetByName('Drive Index') || ss.insertSheet('Drive Index');
  idx.clearContents();
  const rows = [['Folder', 'File', 'Link', 'Matched to']].concat(files.map(function (f) {
    return [f.path.join(' / '), f.name, f.url, matchedTo[f.url] || ''];
  }));
  idx.getRange(1, 1, rows.length, 4).setValues(rows);
  idx.getRange(1, 1, 1, 4).setFontWeight('bold');

  PROP.setProperty('lastRelink', String(Date.now()));
  console.log('Drive scan: ' + files.length + ' files, ' + linked + ' materials auto-linked, ' +
    Object.keys(subjectFolders).length + ' subject folders.');
}

function subjectsInName_(name, subjectKeys) {
  const compact = String(name).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const words = String(name).toUpperCase().split(/[^A-Z0-9]+/);
  return Object.keys(subjectKeys).filter(function (k) {
    if (words.indexOf(k) !== -1) return true;
    if (k.length >= 4 && compact.indexOf(k) !== -1) return true;
    // e.g. "MM-II", "QM 2"
    return compact === k || compact === k.replace(/II$/, '2');
  });
}

function bestFile_(subject, code, title, files) {
  const mainTitle = title.replace(/\([^)]*\)/g, ' ').split(/\s[–—]\s/)[0];
  const words = tokens_(mainTitle).filter(function (w) { return w.length >= 3 && !STOP_WORDS[w]; });
  const productCodes = (title.match(/\b(?:\d-\d{3}-\d{3}|\d{6}|[A-Z]{1,2}\d{3,}[A-Z0-9]*|R\d{4}[A-Z])\b/g) || [])
    .map(compact_).filter(function (c) { return c.length >= 5; });
  const p = code.match(/^([A-Z]+)(\d+)$/);
  const codeRe = p ? new RegExp('(^|[^a-z0-9])(' + ({ C: 'c|case', R: 'r|reading', TN: 'tn|note', SIM: 'sim|simulation', X: 'x' }[p[1]] || p[1]) +
    ')[\\s_\\-.]*0*' + p[2] + '($|[^0-9])', 'i') : null;

  let best = null, bestScore = 0;
  files.forEach(function (f) {
    if (f.subjects.length && f.subjects.indexOf(subject) === -1) return;   // another subject's folder
    const inSubject = f.subjects.indexOf(subject) !== -1;
    const fileWords = tokens_(f.name);
    const titleScore = words.length ? words.filter(function (w) { return fileWords.indexOf(w) !== -1; }).length / words.length : 0;
    const fileCompact = compact_(f.name);
    const product = productCodes.some(function (c) { return fileCompact.indexOf(c) !== -1; });
    const codeHit = codeRe ? codeRe.test(f.name) : false;
    let score = titleScore + (product ? 1 : 0) + (codeHit && inSubject ? 0.6 : 0) + (inSubject ? 0.15 : 0);
    const ok = titleScore >= 0.6 || product || (codeHit && inSubject);
    if (ok && score >= 0.75 && score > bestScore) { best = f; bestScore = score; }
  });
  return best;
}

function tokens_(s) { return String(s).toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter(Boolean); }
function compact_(s) { return String(s).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

/* ===================================================================== */
/*  Version 1 clean-up                                                    */
/* ===================================================================== */

function removeVersion1_() {
  // Only from today on: past v1 events stay as a record, since v2 never creates past events.
  const today = Utilities.formatDate(new Date(), CONFIG.timeZone, 'yyyy-MM-dd');
  const from = today > CONFIG.firstDate ? today : CONFIG.firstDate;
  const cal = CalendarApp.getDefaultCalendar();
  const events = cal.getEvents(dateAt_(from, '00:00'), dateAt_(CONFIG.lastDateExclusive, '00:00'));
  let removed = 0;
  events.forEach(function (ev) {
    const isV1 = CONFIG.v1EventTags.some(function (tag) { return ev.getTag(tag); });
    if (isV1) { ev.deleteEvent(); removed++; }
  });
  console.log('Removed ' + removed + ' version 1 events from your main calendar.');
}

/* ===================================================================== */
/*  Helpers                                                               */
/* ===================================================================== */

function listTaggedEvents_(calendarId, timeMin, timeMax) {
  const out = [];
  let pageToken;
  do {
    const res = withRetry_(function () {
      return Calendar.Events.list(calendarId, {
        timeMin: timeMin, timeMax: timeMax, singleEvents: true, maxResults: 2500,
        privateExtendedProperty: EVENT_MARK + '=1', pageToken: pageToken
      });
    }, 'list events');
    (res.items || []).forEach(function (ev) {
      if (ev.extendedProperties && ev.extendedProperties.private && ev.extendedProperties.private.key) out.push(ev);
    });
    pageToken = res.nextPageToken;
  } while (pageToken);
  return out;
}

function deleteEvent_(calendarId, eventId) {
  try {
    withRetry_(function () { Calendar.Events.remove(calendarId, eventId); }, 'delete event');
  } catch (e) {
    if (!/not found|deleted|410|404/i.test(e.message)) throw e;
  }
}

function withRetry_(fn, label) {
  for (let attempt = 0; ; attempt++) {
    try {
      return fn();
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (attempt < 4 && /rate ?limit|quota|usageLimits|backend error|internal error|service unavailable|timed out|try again/i.test(msg)) {
        Utilities.sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      throw new Error(label + ': ' + msg);
    }
  }
}

function scheduleContinuation_() {
  const t = ScriptApp.newTrigger('syncAllSections').timeBased().after(60 * 1000).create();
  PROP.setProperty('continuationTrigger', t.getUniqueId());
}

function clearContinuation_() {
  const id = PROP.getProperty('continuationTrigger');
  if (!id) return;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getUniqueId() === id) ScriptApp.deleteTrigger(t);
  });
  PROP.deleteProperty('continuationTrigger');
}

function requireDetailsSheet_() {
  if (!CONFIG.detailsSpreadsheetId || /PASTE/.test(CONFIG.detailsSpreadsheetId)) {
    throw new Error('Set CONFIG.detailsSpreadsheetId to your Session Details Google Sheet ID first.');
  }
}

function readTable_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Session Details sheet has no "' + name + '" tab.');
  const values = sh.getDataRange().getValues();
  const head = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  return values.slice(1).map(function (row) {
    const o = {};
    head.forEach(function (h, i) { o[h] = row[i]; });
    return o;
  });
}

function dateAt_(dateKey, time) {
  return Utilities.parseDate(dateKey + ' ' + time, CONFIG.timeZone, 'yyyy-MM-dd HH:mm');
}

function isoAt_(dateKey, time) {
  return Utilities.formatDate(dateAt_(dateKey, time), CONFIG.timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function hash_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

function log_(previewOnly, action, section, key, title) {
  console.log((previewOnly ? '[PREVIEW] ' : '') + action + ' ' + key + '  ' + title);
}

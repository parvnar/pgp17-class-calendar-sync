/**
 * PGP17 Term II pre-midterm calendar sync.
 * Creator: Parv Nar
 * Please retain the creator credit when sharing this script or its output.
 * Share a copy after changing only TARGET_SECTION below.
 * Run syncSchedule once, then attach one hourly trigger to syncSchedule.
 */
const TARGET_SECTION = 'E'; // Change only this letter: A, B, C, D, or E.
const CREATOR_CREDIT = '\u00A9 Parv Nar';

const SCHEDULE_SYNC = {
  spreadsheetId: '1En591R2sVtII-zUMriVSKB0Pi7ZtLQxLbNDtS_OcGpQ',
  sheetName: 'PGP17 Term -II PrMT',
  timeZone: 'Asia/Kolkata',
  firstDate: '2026-10-01',
  lastDateExclusive: '2026-11-22', // Includes the 17-21 November exam period.
  eventTag: 'pgp17PrMT2ScheduleSlot',
  legacyEventTag: 'pgp17PrMT2SectionESlot',
  instanceProperty: 'pgp17PrMT2ScriptInstance',
  slots: [
    { column: 2, letter: 'C' },
    { column: 3, letter: 'D' },
    { column: 4, letter: 'E' }
  ]
};

function syncSchedule() {
  runSchedule_(false);
}

// Optional: run this first to see changes in the Execution log without editing Calendar.
function previewSchedule() {
  runSchedule_(true);
}

// Keep an existing trigger from the earlier Section E version working.
function syncSectionESchedule() {
  syncSchedule();
}

function previewSectionESchedule() {
  previewSchedule();
}

function runSchedule_(previewOnly) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Another timetable sync is already running.');
  }

  try {
    // Read and validate the entire sheet before changing any calendar event.
    const spreadsheet = SpreadsheetApp.openById(SCHEDULE_SYNC.spreadsheetId);
    const sheet = spreadsheet.getSheetByName(SCHEDULE_SYNC.sheetName);
    if (!sheet) {
      throw new Error('Timetable tab not found: ' + SCHEDULE_SYNC.sheetName);
    }
    const data = sheet.getDataRange().getValues();
    const plan = buildSchedulePlan_(data, spreadsheet.getSpreadsheetTimeZone());
    if (plan.firstSyncDate >= SCHEDULE_SYNC.lastDateExclusive) {
      console.log('No upcoming pre-midterm 2 dates remain to sync.');
      return;
    }
    const calendar = CalendarApp.getDefaultCalendar();
    if (!calendar) {
      throw new Error('The institute account has no default calendar.');
    }

    const start = dateTime_(plan.firstSyncDate, '00:00');
    const end = dateTime_(SCHEDULE_SYNC.lastDateExclusive, '00:00');
    const instancePrefix = getScheduleInstanceId_() + '|';
    const eventsBySlot = {};

    calendar.getEvents(start, end).forEach(function (event) {
      const tagValue = event.getTag(SCHEDULE_SYNC.eventTag);
      const slotKey = tagValue && tagValue.indexOf(instancePrefix) === 0
        ? tagValue.slice(instancePrefix.length)
        : (TARGET_SECTION === 'E' ? event.getTag(SCHEDULE_SYNC.legacyEventTag) : null);
      if (slotKey) {
        if (!eventsBySlot[slotKey]) eventsBySlot[slotKey] = [];
        eventsBySlot[slotKey].push(event);
      }
    });

    const counts = { added: 0, updated: 0, removed: 0, unchanged: 0 };

    Object.keys(plan.expected).sort().forEach(function (slotKey) {
      const wanted = plan.expected[slotKey];
      const matches = eventsBySlot[slotKey] || [];
      const event = matches.shift();

      if (!event) {
        logScheduleAction_(previewOnly, 'ADD', slotKey, wanted.title);
        if (!previewOnly) {
          const created = calendar.createEvent(
            wanted.title, wanted.start, wanted.end,
            { description: wanted.description }
          );
          created.setTag(SCHEDULE_SYNC.eventTag, instancePrefix + slotKey);
          created.setColor(wanted.color);
        }
        counts.added++;
      } else {
        const changed = event.getTitle() !== wanted.title ||
          event.getDescription() !== wanted.description ||
          event.getStartTime().getTime() !== wanted.start.getTime() ||
          event.getEndTime().getTime() !== wanted.end.getTime() ||
          String(event.getColor()) !== String(wanted.color);

        if (changed) {
          logScheduleAction_(previewOnly, 'UPDATE', slotKey, wanted.title);
          if (!previewOnly) {
            if (event.getTitle() !== wanted.title) event.setTitle(wanted.title);
            if (event.getDescription() !== wanted.description) {
              event.setDescription(wanted.description);
            }
            if (event.getStartTime().getTime() !== wanted.start.getTime() ||
                event.getEndTime().getTime() !== wanted.end.getTime()) {
              event.setTime(wanted.start, wanted.end);
            }
            if (String(event.getColor()) !== String(wanted.color)) {
              event.setColor(wanted.color);
            }
          }
          counts.updated++;
        } else {
          counts.unchanged++;
        }
        if (!previewOnly && event.getTag(SCHEDULE_SYNC.legacyEventTag)) {
          event.setTag(SCHEDULE_SYNC.eventTag, instancePrefix + slotKey);
          event.deleteTag(SCHEDULE_SYNC.legacyEventTag);
        }
      }

      // Any extra event carrying the same slot tag is a duplicate.
      matches.forEach(function (duplicate) {
        logScheduleAction_(previewOnly, 'REMOVE DUPLICATE', slotKey, duplicate.getTitle());
        if (!previewOnly) duplicate.deleteEvent();
        counts.removed++;
      });
      delete eventsBySlot[slotKey];
    });

    // A tagged event with no matching class is a cancelled or removed class.
    Object.keys(eventsBySlot).forEach(function (slotKey) {
      eventsBySlot[slotKey].forEach(function (event) {
        logScheduleAction_(previewOnly, 'REMOVE', slotKey, event.getTitle());
        if (!previewOnly) event.deleteEvent();
        counts.removed++;
      });
    });

    console.log((previewOnly ? 'PREVIEW' : 'SYNC') + ': ' + JSON.stringify(counts));
  } finally {
    lock.releaseLock();
  }
}

function getScheduleInstanceId_() {
  const properties = PropertiesService.getScriptProperties();
  let id = properties.getProperty(SCHEDULE_SYNC.instanceProperty);
  if (!id) {
    id = Utilities.getUuid();
    properties.setProperty(SCHEDULE_SYNC.instanceProperty, id);
  }
  return id;
}

function buildSchedulePlan_(data, sheetTimeZone) {
  const section = String(TARGET_SECTION).trim().toUpperCase();
  if (!/^[A-E]$/.test(section)) {
    throw new Error('TARGET_SECTION must be one letter from A to E.');
  }
  if (data.length < 3 || String(data[1][1]).trim().toLowerCase() !== 'sections') {
    throw new Error('The sheet layout has changed: row 2 must contain Sections.');
  }

  const slotTimes = SCHEDULE_SYNC.slots.map(function (slot) {
    const header = String(data[1][slot.column] || '');
    const match = header.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
    if (!match) throw new Error('Cannot read the time in header ' + slot.letter + '2.');
    return { column: slot.column, letter: slot.letter, start: match[1], end: match[2] };
  });

  const courseNames = {};
  const facultyNames = {};
  data.forEach(function (row) {
    const course = String(row[8] || '').trim();
    const courseMatch = course.match(/^(.+?)\s*\(([^)]+)\)/);
    if (courseMatch) {
      courseNames[courseMatch[2].trim().toUpperCase()] = courseMatch[1].trim();
    }
    const facultyCode = String(row[11] || '').trim().toUpperCase();
    const facultyName = String(row[10] || '').trim();
    if (facultyCode && facultyName) facultyNames[facultyCode] = facultyName;
  });

  const today = Utilities.formatDate(new Date(), SCHEDULE_SYNC.timeZone, 'yyyy-MM-dd');
  const firstSyncDate = today > SCHEDULE_SYNC.firstDate ? today : SCHEDULE_SYNC.firstDate;
  const expected = {};
  const sectionDates = {};
  let currentDate = null;
  let datedRows = 0;
  let sectionRows = 0;

  for (let rowIndex = 2; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    if (row[0] instanceof Date && !isNaN(row[0].getTime())) {
      currentDate = Utilities.formatDate(row[0], sheetTimeZone, 'yyyy-MM-dd');
      datedRows++;
    }
    if (String(row[1] || '').trim().toUpperCase() !== section) continue;
    if (!currentDate) throw new Error('Section ' + section + ' row has no date near row ' + (rowIndex + 1));
    sectionRows++;
    if (sectionDates[currentDate]) {
      throw new Error('Duplicate Section ' + section + ' rows on ' + currentDate);
    }
    sectionDates[currentDate] = true;

    if (currentDate < firstSyncDate || currentDate >= SCHEDULE_SYNC.lastDateExclusive) {
      continue;
    }

    slotTimes.forEach(function (slot) {
      const raw = String(row[slot.column] || '').replace(/\s+/g, ' ').trim();
      if (!raw || raw === '-') return;

      const parsed = raw.match(/^(.*?)\s*(\d+)\s*\(([^()]*)\)\s*$/);
      const courseCode = parsed ? parsed[1].trim().toUpperCase() : raw.toUpperCase();
      const facultyCode = parsed ? parsed[3].trim().toUpperCase() : '';
      const fullCourse = courseNames[courseCode] || courseCode;
      const fullFaculty = facultyNames[facultyCode] || facultyCode || 'Not listed in timetable';
      const slotKey = currentDate + '|' + slot.letter;

      expected[slotKey] = {
        title: raw,
        description: 'Subject: ' + fullCourse + '\nFaculty: ' + fullFaculty +
          '\n\n' + CREATOR_CREDIT,
        start: dateTime_(currentDate, slot.start),
        end: dateTime_(currentDate, slot.end),
        color: colorForCourse_(courseCode)
      };
    });
  }

  // The supplied timetable has 47 date rows and many rows per section. Stop
  // rather than erase events if a broken import returns only a fragment.
  if (datedRows < 20 || sectionRows < 15) {
    throw new Error('The timetable looks incomplete; no calendar changes were made.');
  }

  return { firstSyncDate: firstSyncDate, expected: expected };
}

function dateTime_(dateKey, time) {
  return Utilities.parseDate(
    dateKey + ' ' + time,
    SCHEDULE_SYNC.timeZone,
    'yyyy-MM-dd HH:mm'
  );
}

function colorForCourse_(courseCode) {
  const colors = {
    'MANAC': CalendarApp.EventColor.BLUE,
    'DA': CalendarApp.EventColor.CYAN,
    'MEB': CalendarApp.EventColor.PALE_GREEN,
    'QM II': CalendarApp.EventColor.ORANGE,
    'MM II': CalendarApp.EventColor.MAUVE,
    'MCOMM': CalendarApp.EventColor.PALE_RED,
    'WIPS': CalendarApp.EventColor.YELLOW,
    'IKS': CalendarApp.EventColor.GRAY,
    'ODD': CalendarApp.EventColor.GREEN,
    'FLP': CalendarApp.EventColor.RED
  };
  return colors[courseCode] || CalendarApp.EventColor.GRAY;
}

function logScheduleAction_(previewOnly, action, slotKey, title) {
  console.log((previewOnly ? '[PREVIEW] ' : '') + action + ' ' + slotKey + ' ' + title);
}

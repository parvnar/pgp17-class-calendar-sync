/**
 * Switching from v1 to the shared section calendars (v2)?
 *
 * Paste this over the code in YOUR OLD v1 Apps Script project, save, and run
 * stopV1AndClean once. It:
 *   1. deletes that project's hourly trigger, so v1 stops running;
 *   2. removes the upcoming class events v1 created in your main calendar.
 *
 * Past classes stay. Your own events are never touched: only events carrying
 * v1's hidden tag are removed.
 */
function stopV1AndClean() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });

  const v1Tags = ['pgp17PrMT2ScheduleSlot', 'pgp17PrMT2SectionESlot'];
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date('2026-11-22T00:00:00+05:30');

  let removed = 0;
  CalendarApp.getDefaultCalendar().getEvents(from, to).forEach(function (event) {
    const isV1 = v1Tags.some(function (tag) { return event.getTag(tag); });
    if (isV1) {
      event.deleteEvent();
      removed++;
    }
  });
  console.log('v1 stopped. Removed ' + removed + ' upcoming class events from your calendar.');
}

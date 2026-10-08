# Changelog

## v2: shared section calendars with prep details (October 2026)
- **One shared calendar per section** (A–E), run centrally and updated hourly. Nobody needs their own script any more: subscribe with your institute ID.
- **Prep details in every class:** topic, book chapters, case and reading with Drive links, room, faculty and session number.
- **Course materials linked automatically:** files in the Term 2 Drive folder are matched to each case and reading by title, HBS product number or C#/R# code. Manual links in the sheet are never overwritten.
- **Every class in the timetable is picked up:** the 14:30 slot, plus extra sessions with their own time written in the cell, e.g. `Mcomm 1 (DS) (16:05-17:20)`.
- **Rescheduled sessions keep their material:** prep details follow the subject and session number, not the date.
- **Fewer calendar edits:** events are only changed when their content actually changes, and long runs continue automatically instead of hitting Apps Script's time limit.
- **Same safety check:** a broken or half-loaded timetable stops the run before any calendar change.
- **Domain-only sharing:** the calendars open only for IIM Rohtak accounts.
- **Switching from v1:** `v2/stop-v1.gs` stops a v1 install and removes its upcoming events.

## v1 (September–October 2026)
- A personal Apps Script per person, choosing the section with `TARGET_SECTION`.
- Adds each class to the person's own calendar with subject and faculty.

# Changelog

All notable changes to this project. Versions follow [Semantic Versioning](https://semver.org/).

## 2.2.0 – 2026-10-20

### Added
- Every class links to the **course outline** and the subject's **Drive folder**.
- Excel sheets, slide decks and alternate versions of a case appear as extra links next to it.
- Session cheat sheets appear under *Class sheets* (MEB sessions 2 and 3).
- `showMySectionInGmail` ticks your own section in Google Calendar on the web, which is what Gmail's side panel shows.
- Optional **Courses** tab in the session-details sheet to override folder and outline links.

### Changed
- Drive links are kept in the script (`DRIVE_LINKS`) instead of being found by an hourly Drive scan, so each sync is faster. Set `scanDriveAutomatically: true` to scan again.
- The README has been redesigned, with light and dark images.

## 2.0.0 – 2026-10-08

### Added
- One shared calendar per section (A–E), run from a single account and synced hourly. Nobody needs their own script.
- Topic, book chapters, case and reading for every session, with links to the course materials.
- Classes outside the main slots, including sessions with their own time written in the cell.
- Calendars shared read-only with IIM Rohtak accounts only.
- `v2/stop-v1.gs` to switch off a v1 install and remove its upcoming events.

### Changed
- Prep details follow the subject and session number, not the date, so they move with rescheduled classes.
- Events are only rewritten when their content changes; long runs continue automatically.

## 1.0.0 – 2026-10-04

### Added
- Personal Apps Script per student that adds their section's classes to their own calendar, with subject and faculty.

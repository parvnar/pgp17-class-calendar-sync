# PGP17 Class Calendar Sync

An Apps Script that keeps one PGP17 Term II pre-midterm section's classes in Google Calendar. It reads the institute timetable and checks for changes every hour, so the short class names stay useful in a phone calendar widget.

## Why I built it

The timetable can change after it is published. I first made a calendar sync for post-midterm classes, then adapted it for the pre-midterm 2 schedule. This version also adds faculty names, subject colours, a preview of changes, and safer handling of cancelled classes.

## What it does

- Syncs the three class slots for **one section (A, B, C, D, or E)**. The afternoon quiz/case-preparation block is ignored.
- Uses the short timetable label as the event title, such as `ODD 1(LRM)`.
- Shows the full subject and faculty names, followed by `© Parv Nar`, in the event description. Fixed section and classroom details are omitted.
- Uses a consistent Google Calendar event colour for each subject.
- Adds new classes, updates changed ones, and removes cancelled classes. Empty cells and `-` mean no class.
- Recognizes only events created by this project, leaving personal events alone. Separate script projects can run for different sections without overwriting one another's events.
- Changes only today's and future events. If the timetable cannot be read or looks incomplete, the script stops before changing the calendar.

For example, a Section E event from the downloaded schedule looks like this:

```text
08:45–10:00  ODD 1(LRM)

Subject: Organizational Design and Dynamics
Faculty: Dr. Lubna Rashid Malik

© Parv Nar
```

The exact appearance of colours and event text in a phone widget depends on the calendar app and widget.

## Built with

- Google Apps Script
- Google Sheets and Google Calendar services
- Script Properties to keep separate copies from changing each other's events

No package installation, API key, or downloaded timetable file is needed to run the script.

## Setup guide

1. Sign in to the **institute Google account** that can open the timetable. The script writes to that account's default Google Calendar.
2. Open [Google Apps Script](https://script.google.com/) and create a new project. Paste the contents of [PrMT2_ScheduleSync.gs](PrMT2_ScheduleSync.gs) into `Code.gs`, replacing the starter function. Save the project.
3. Near the top, change only `TARGET_SECTION = 'E'` to your section letter (`A`, `B`, `C`, `D`, or `E`). Keep the quotation marks. This version is tied to the PGP17 pre-midterm 2 sheet and its date range.
4. In **Project Settings**, set the script time zone to **Asia/Kolkata**.
5. Select **`previewSchedule`** in the function menu and click **Run**. Approve the requested Google permissions. Open **Executions** to inspect the `ADD`, `UPDATE`, and `REMOVE` lines. Preview does not edit Calendar.
6. Select **`syncSchedule`** and run it once. Check the institute account's Google Calendar for the class events and their descriptions.
7. In Apps Script, open **Triggers** (clock icon), choose **Add Trigger**, select `syncSchedule`, select **Time-driven**, then choose **Hour timer** and **Every hour**. Keep just one hourly trigger for each script project.
8. Enable the institute account's calendar in the Google Calendar app and your phone widget.

If you are replacing the earlier Section E code in the **same** Apps Script project, its existing `syncSectionESchedule` trigger still works. Do not add a second hourly trigger for the same project.

Google's [installable trigger guide](https://developers.google.com/apps-script/guides/triggers/installable) explains the trigger settings. Hourly means the calendar follows changes on the next run; it is not instantaneous.

## Sharing with another section

Make a **separate Apps Script project** for each person or section, paste the same script, and change `TARGET_SECTION` at the top. Each copy needs an account with access to the institute sheet and its own hourly trigger. Copies use different internal identifiers, so they will not change each other's events if they happen to use the same calendar.

The source file and events credit **Parv Nar**. Please retain that credit when sharing. Apps Script source shared with edit access can be changed, including the credit; the watermark is visible attribution, not encryption or a technical lock. For stronger control of the original code, keep the Apps Script project private and share a calendar with view-only access instead.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| `Timetable tab not found` | The live Google Sheet must have a tab named `PGP17 Term -II PrMT`. |
| Permission error when running | Use a Google account that can open the institute sheet and write to its default calendar. |
| `The timetable looks incomplete` | Check that the full schedule and the selected section's rows are present. The script stops to avoid deleting events from a partial import. |
| No upcoming dates remain | This script covers 1 October to 21 November 2026. It stops after that range. |
| Wrong section appears | Check the single `TARGET_SECTION` line and run the preview again. |
| Duplicate hourly updates | Remove extra triggers for the same Apps Script project. |

The script does not copy the spreadsheet itself into this repository. The source Google Sheet has restricted access, and this project has not been run against the live sheet or calendar from this repository.

## Project status

The code has passed local syntax and simulated sync checks for repeat runs, changed classes, cancellations, and separate section copies. The first live run should start with `previewSchedule`, followed by a manual `syncSchedule` check before enabling the hourly trigger.

Created by **Parv Nar**.

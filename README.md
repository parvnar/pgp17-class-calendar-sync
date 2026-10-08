# PGP17 class calendar

Every PGP17 Term II class for your section, in Google Calendar, kept up to date **every hour** from the institute timetable.

**Version 2.** Each class now shows what to prepare for it:

- 📘 **Topic** of the session and the **book chapters** to read
- 📄 **Case to prepare**, with a link that opens the PDF from the course Drive folder
- 📑 **Reading**, also linked
- 📍 **Room**, faculty and session number

Nothing to install. Add your section's calendar once and it updates itself. Rescheduled, extra and cancelled classes follow the timetable automatically.

**Made by Parv Nar.**

<img src="images/android-widget-example.jpg" alt="Android home screen showing the Google Calendar schedule widget with coloured classes" width="320">

---

## 1 → Add your section's calendar

| Section | Add to Google Calendar |
| :-: | --- |
| **A** | [➕ Add Section A](LINK_A) |
| **B** | [➕ Add Section B](LINK_B) |
| **C** | [➕ Add Section C](LINK_C) |
| **D** | [➕ Add Section D](LINK_D) |
| **E** | [➕ Add Section E](LINK_E) |

🔒 The calendars only open for **@iimrohtak.ac.in** accounts. Use your institute ID, not personal Gmail.

### On a laptop
1. Make sure Chrome is signed in to your **institute Google account**. If you have several accounts, open [Google Calendar](https://calendar.google.com/) and switch to the institute one first.
2. Click your section's link above → **Add**.

### On an Android phone
1. Open your section's link in **Chrome**. If the Calendar app opens instead, go back and stay in Chrome.
2. Tap **⋮** (top right) → tick **Desktop site**.
3. Check the account shown at the top right is your institute ID → tap **Add**.
4. Open the **Google Calendar app** → **☰ Menu** → under your institute account, make sure **PGP17 Term II – Section X** is ticked.

### On an iPhone
Safari and the iOS Calendar app can't subscribe to a Google calendar this way. Add it once from a laptop (or from Chrome on Android) with your institute ID. Then, in the **Google Calendar app** on your iPhone, sign in with the same institute account. The section calendar appears there automatically.

### Link didn't work?
On a laptop, open [Google Calendar](https://calendar.google.com/) with your institute ID → **Other calendars → + → Subscribe to calendar** → paste your section's Calendar ID:

| Section | Calendar ID |
| :-: | --- |
| A | `ID_A` |
| B | `ID_B` |
| C | `ID_C` |
| D | `ID_D` |
| E | `ID_E` |

---

## 2 → Did you set up the old version (v1)?

If you ran the v1 script from this page in your own Apps Script project, **stop it now**. Otherwise every class appears twice: once from your v1, once from the shared calendar.

1. Open [Google Apps Script](https://script.google.com/home) with your institute ID → open your v1 project (e.g. `My class calendar`).
2. Open **[v2/stop-v1.gs](v2/stop-v1.gs)** → copy the code with the copy icon next to **Raw**.
3. In your project, select all the code in `Code.gs` → paste → **Save**.
4. Function menu → `stopV1AndClean` → **Run** → allow permissions if asked.
5. The **Execution log** says `v1 stopped. Removed N upcoming class events…`. Done. You can delete that project afterwards.

It removes only the upcoming class events your v1 created, using v1's hidden tag. Your own events and past classes stay. Then add your section's calendar from step 1.

Don't set up v2 on your own account. One copy runs centrally and everyone subscribes to it.

---

## 3 → Put the classes on your home screen

### Android
1. Touch and hold an empty spot on the Home screen → **Widgets**.
2. **Google Calendar** → touch and hold **Calendar schedule** → drag it onto the screen.
3. Touch and hold the widget → drag its edges to make it taller.

[Google's Android widget guide](https://support.google.com/calendar/answer/10249848?co=GENIE.Platform%3DAndroid&hl=en)

### iPhone
1. Open the **Google Calendar app** once and check your section's classes are visible.
2. Touch and hold the Home Screen → **Edit** → **Add Widget** → search **Google Calendar** → pick a size → **Add Widget**.

[Google's iPhone widget guide](https://support.google.com/calendar/answer/10249848?co=GENIE.Platform%3DiOS&hl=en)

---

## Tips

- **Hide sections you don't need.** If you added more than one, untick the others in the Calendar sidebar or menu.
- **Your own reminders.** Calendar settings → *PGP17 Term II – Section X* → **Event notifications**, e.g. 30 minutes before.
- **"File not on Drive yet"** next to a case means the PDF hasn't been uploaded. The link appears automatically once it is.
- **A case link says "request access".** Make sure you're signed in with your institute ID.

## If something looks wrong

| What you see | Why / what to do |
| --- | --- |
| "You do not have access" / can't add | You're on a personal Gmail account. Switch to your institute ID. |
| Calendar added but empty on phone | Calendar app → ☰ → tick *PGP17 Term II – Section X* under the institute account. |
| Every class shows twice | Your old v1 is still running. Do step 2. |
| A class differs from the timetable | The calendar refreshes hourly. If it's still wrong after an hour, tell the maintainer. |

---

## For the maintainer

The script runs from a single institute account and keeps all five calendars updated. Setup, configuration and the session-details sheet are explained in **[v2/SETUP.md](v2/SETUP.md)**.

| Path | What it is |
| --- | --- |
| [`v2/Code.gs`](v2/Code.gs) | The v2 sync script (all sections, hourly) |
| [`v2/appsscript.json`](v2/appsscript.json) | Manifest (enables the Google Calendar API service) |
| [`v2/stop-v1.gs`](v2/stop-v1.gs) | Stops a v1 install and removes its upcoming events |
| [`v2/tools/build_details.py`](v2/tools/build_details.py) | Builds the Session Details workbook from the course prep plan |
| [`v1/`](v1/) | Version 1: per-person script and its original guide |

See [CHANGELOG.md](CHANGELOG.md) for what changed.

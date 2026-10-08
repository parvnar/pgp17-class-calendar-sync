# v2 maintainer setup (≈10 minutes, on a laptop)

Only **one person** sets this up. Everyone else just subscribes using the links in the [main README](../README.md).

Do everything signed in with your **institute Google account**.

## 1. Make the Session Details sheet
1. Build the workbook from the course prep plan (or reuse the existing one):
   `python3 tools/build_details.py Term2_Session_Prep_Plan.xlsx PGP17_Term2_Session_Details.xlsx`
   Neither workbook is committed to this repo.
   Upload `PGP17_Term2_Session_Details.xlsx` to your Drive.
2. Open it → **File → Save as Google Sheets**. Use the new Google Sheet from now on, and delete the .xlsx copy.
3. Copy the sheet's ID from its URL: `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.

## 2. Update the Apps Script project (the one running v1)
1. Open your existing project at script.google.com.
2. **Project Settings (⚙️)** → tick **Show "appsscript.json" manifest file in editor**.
3. Open `appsscript.json`, replace everything with the provided `appsscript.json`, and save.
   (This turns on the Google Calendar API service. Alternatively: **Services (+)** → *Google Calendar API* → Add.)
4. Open `Code.gs`, replace everything with [`Code.gs`](Code.gs), and fill in the two IDs at the top:
   - `detailsSpreadsheetId`: your Session Details Google Sheet ID;
   - `materialsFolderId`: the Term 2 materials Drive folder ID (the part after `/folders/` in its URL).

   Save. The repo keeps these as placeholders so the private sheet and folder aren't published.
5. **Triggers (⏰)**: delete the old v1 hourly trigger (setup also does this, but it's cleaner).

## 3. Run setup once
1. In the function dropdown pick **`previewAllSections`** → **Run** → approve permissions.
   The Execution log lists every event it *would* create. Nothing changes yet.
2. Pick **`setupV2`** → **Run**. It:
   - creates 5 calendars, "PGP17 Term II – Section A" … "E", shared read-only with everyone at your institute;
   - removes the old v1 Section E events from your main calendar;
   - scans the Term 2 Drive folder and fills links in the **Materials** tab;
   - writes the add-to-calendar links to the **Calendar Links** tab;
   - starts the hourly trigger and does the first sync. The first sync creates ~320 events and may
     take two runs; the second run starts by itself a minute later.

## 4. Share with the batch
Copy each section's link and Calendar ID from the **Calendar Links** tab into the tables in the [main README](../README.md). Then send each section its link. Message to paste:

> Section X class calendar (auto-updates hourly from the timetable, with topic, case and reading links for every session).
> Open this link on a laptop, or in Chrome with "Desktop site" on, while signed in with your **institute ID**, then tap **Add**:
> LINK
> It then shows up in the Google Calendar app on your phone. Only IIM Rohtak accounts can open it.

If the link ever fails for someone, they can use **Other calendars → + → Subscribe to calendar** and paste the Calendar ID from the same tab.

For yourself: in Google Calendar's sidebar, untick Sections A–D to hide them.

## 5. Make the materials open for everyone
The calendar only shares *links*. Classmates also need access to the files:
in Drive, right-click the **Term 2** folder → **Share** → General access → **IIM Rohtak** → *Anyone in this group with the link can view*.
(If someone else owns the folder, ask them to do this.)

## Switching from v1
`setupV2` removes the upcoming v1 events from the maintainer's own main calendar (both v1 tags). To run that clean-up again later, run `removeOldV1Events`. Batchmates who ran v1 themselves should follow [the main README](../README.md#already-set-up-the-old-version) ([`stop-v1.gs`](stop-v1.gs)).

## Day-to-day
| You want to… | Do this |
|---|---|
| Add a missing case/reading file | Put it in the Term 2 folder. Within ~3 hours it's matched automatically (or run `relinkMaterialsNow`). |
| Fix a wrong link | Paste the right link in **Materials → Link** and clear **Link Source**. Manual links are never overwritten. |
| Re-match a row | Clear both **Link** and **Link Source**. |
| Change a topic or case | Edit the **Sessions** tab. Events update on the next hourly run. |
| Give one faculty a different plan | Add a Sessions row with their code in **Faculty (optional)**, e.g. `MCOMM, 2, DS, …`. |
| See what happened | **Calendar Links** tab (last sync, result, warnings) or Apps Script → Executions. |
| Check unmatched files | **Drive Index** tab, where a blank "Matched to" means the file wasn't linked. |

## After the mid-term
When the post-mid-term timetable comes out, change `timetableSheetName`, `firstDate` and
`lastDateExclusive` in CONFIG. The same calendars keep working, so classmates don't need new links.

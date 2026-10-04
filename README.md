# PGP17 class calendar sync

Put your **Pre Mid Term 2 classes** in Google Calendar. The calendar checks the institute timetable about once an hour and updates your future classes when the sheet changes.

**Made by Parv Nar.** Each class has a short name for a phone widget, a subject colour, and the full subject and faculty names inside the event.

## Before you start

- Use the **institute Google account** that can open the [PGP17 timetable](https://docs.google.com/spreadsheets/d/1En591R2sVtII-zUMriVSKB0Pi7ZtLQxLbNDtS_OcGpQ/edit). The classes will be added to **that account's calendar**.
- Know your section letter: **A, B, C, D, or E**.
- Do these steps on a **computer**. You can view the result on your phone afterward.
- Allow about **10 minutes** for setup.

## Set it up once

### 1. Copy the script

Open **[PrMT2_ScheduleSync.gs](PrMT2_ScheduleSync.gs)**. Above the code, click the **copy icon** beside **Raw**. This copies the whole script.

<img src="https://github.com/user-attachments/assets/b61d9d06-b484-4848-b4d8-0e9b46ece00b" alt="Screenshot of the script on GitHub. The Copy raw file button is above the code, next to Raw." width="900">

### 2. Create a Google Apps Script project

While signed in to your **institute account**, open **[Google Apps Script](https://script.google.com/home)** and click **New project**.

<img src="https://github.com/user-attachments/assets/45017d3e-1918-42ee-bb1f-c5ab57ce6304" alt="Screenshot of the Google Apps Script home page showing the New project button in the top left." width="900">

In the new project, open `Code.gs`. Delete the starter code and **paste** the script you copied. Give the project a name such as `My class calendar`.

### 3. Choose your section

Near the top of the code, find this line:

```javascript
const TARGET_SECTION = 'E';
```

Replace **only the letter between the quotation marks** with your section. For example, Section B should say `const TARGET_SECTION = 'B';`. Then click **Save** (the disk icon). You do not need to change anything else.

### 4. Check what will happen

At the top of the Apps Script editor, open the **function menu**, choose `previewSchedule`, and click **Run**. The first run asks you to sign in and allow access to the timetable and your calendar. Select the **institute account** and approve the permissions if you trust this script.

Look at the **Execution log** at the bottom. `ADD` means a class will be created; `UPDATE` means one will change; `REMOVE` means one will be deleted. **Preview does not change the calendar.** If you see an error, use the help table below before going further.

### 5. Add the classes

Choose `syncSchedule` from the same function menu and click **Run** once. Open [Google Calendar](https://calendar.google.com/) while signed in to the institute account and check a future class. Its short title should look like `ODD 1(LRM)`; opening it shows the full subject, faculty, and `© Parv Nar`.

### 6. Make it update every hour

In Apps Script, click the **clock icon** on the left (**Triggers**), then **Add Trigger**. Choose:

| Setting | Select |
| --- | --- |
| Function to run | `syncSchedule` |
| Event source | **Time-driven** |
| Type | **Hour timer** |
| Interval | **Every hour** |

The screenshots below show the top and bottom of the same trigger window. The project name is only an example.

<img src="https://github.com/user-attachments/assets/816aec7c-a08d-4087-910a-72b3e56d3bb5" alt="Top of the Apps Script Add Trigger window, showing syncSchedule, Time-driven, and Hour timer." width="900">

<img src="https://github.com/user-attachments/assets/2bbb1523-57dc-4ee5-8820-73fefc7c83c0" alt="Bottom of the Add Trigger window, showing Time-driven, Hour timer, Every hour, and Save." width="900">

Click **Save**. Add **one** hourly trigger for this project. Sheet changes will usually reach your calendar on the next hourly run, not immediately.

## See the classes on your phone

Add the **institute Google account** to your phone's Google Calendar app. Make sure its calendar is visible in the app and in your widget. The widget may show colours and text differently depending on the phone app.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| No classes in your calendar | Check that you are viewing the **institute account's calendar**, then run `syncSchedule` once and check the **Execution log**. |
| Permission or access error | Confirm the same account can open the [institute timetable](https://docs.google.com/spreadsheets/d/1En591R2sVtII-zUMriVSKB0Pi7ZtLQxLbNDtS_OcGpQ/edit). If your institute blocks Apps Script, ask its IT team. |
| Wrong section | Correct the single `TARGET_SECTION` letter, save, preview, then run `syncSchedule`. |
| Timetable looks incomplete | Stop and check that the live sheet loads fully. The script protects your calendar by making no changes when it cannot read enough rows. |
| No upcoming dates remain | This version covers **1 October to 21 November 2026**. It is for the Pre Mid Term 2 schedule only. |

If you previously used the older **Section E** script in the *same* Apps Script project, its existing hourly trigger may still run this new version. Check **Triggers** before adding another one.

## For another section

Make a **new Apps Script project** and follow the same steps, changing just `TARGET_SECTION`. Every copy needs access to the institute sheet. Please keep **Parv Nar** credited when sharing. Public code and visible calendar credit can be changed by someone who copies the project; they are attribution, not a technical lock.

The private timetable is not stored here. This script was checked with sample data, but the first run on the live timetable should start with `previewSchedule`.

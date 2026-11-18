# How to upload Dawn Chorus to TestFlight

Thanks for doing this! This folder is a complete iPhone app: a free, open-source alarm clock that wakes you with a different real bird each morning. These steps build it in Expo's cloud (no Xcode needed, and it works from a Mac or a Windows PC), upload it to your Apple Developer account, and put it on TestFlight so your kid can install it. Nothing goes on the public App Store.

It takes about an hour, and most of that is waiting for the cloud build and Apple's processing.

## What you need

- Your **Apple Developer account** login (the paid one). You'll sign in during the build and Apple will send a 6-digit code to your devices.
- **Node.js** (the LTS version) from https://nodejs.org. Install it with the default options.
- A free **Expo account** from https://expo.dev/signup. Expo's free plan includes enough cloud iPhone builds for this.
- Your **Team ID**: go to https://developer.apple.com/account, scroll to **Membership details**, and copy the 10-character Team ID (looks like `A1B2C3D4E5`).

## 1. Unzip and add your Team ID

1. Unzip the folder anywhere, for example your Desktop.
2. Open `dawn-chorus/app/app.json` in any text editor (TextEdit, Notepad).
3. Find `"bundleIdentifier": "io.github.dawnchorus.app",` and add one line under it with your Team ID:

   ```json
   "bundleIdentifier": "io.github.dawnchorus.app",
   "appleTeamId": "A1B2C3D4E5",
   ```

   Keep the comma at the end of the line. Save the file.

The app includes a small widget extension (the Lock Screen display while the alarm rings or snoozes), and it needs the Team ID to be signed.

## 2. Open a terminal in the app folder

- **Mac:** open Terminal, type `cd ` (with a space), drag the `dawn-chorus/app` folder into the window, press Return.
- **Windows:** open the `dawn-chorus\app` folder in File Explorer, click the address bar, type `powershell`, press Enter.

Run each of these one at a time and wait for it to finish:

```
npm install
```

```
npm install --global eas-cli
```

(On a Mac, if that second one says "permission denied", run `sudo npm install --global eas-cli` and enter your Mac password.)

```
eas login
```

Sign in with the Expo account.

```
eas init
```

Say **yes** when it asks to create a project.

## 3. Build the app in the cloud

```
eas build --platform ios --profile production
```

Answer the questions like this:

- **Do you want to log in to your Apple account?** Yes. Sign in with your Apple Developer Apple ID and enter the code Apple sends you.
- **Select a team:** pick your team if it asks.
- **Generate a new Apple Distribution Certificate?** Yes.
- **Generate a new Apple Provisioning Profile?** Yes. It will do this twice: once for the app (`io.github.dawnchorus.app`) and once for its widget (`io.github.dawnchorus.app.alarmwidget`). That's expected.
- Anything about push notifications: **No**.

The build runs on Expo's servers for about 15 to 30 minutes. It prints a link where you can watch it. You can close the terminal; the build keeps going.

## 4. Upload it to Apple

When the build has finished:

```
eas submit --platform ios --latest
```

- Sign in to Apple again if it asks.
- If it asks to create the app in App Store Connect, say **yes**.
- If the name **Dawn Chorus** is already taken on the App Store, change `"name": "Dawn Chorus"` in `app.json` to something like `"Dawn Chorus Alarm"`, then run steps 3 and 4 again.

Apple then processes the build, usually in 10 to 30 minutes. You'll get an email when it's ready.

## 5. Give your kid access in TestFlight

1. Go to https://appstoreconnect.apple.com, then **Users and Access**, then **+**. Add your kid's Apple ID email with the **Developer** role (any role works for testing), and send the invite. They accept it from the email.
2. Go to **Apps**, then **Dawn Chorus**, then **TestFlight**.
3. Under **Internal Testing**, click **+** to make a group (name it anything), add your kid, and add the build to the group. If Apple asks about encryption, choose "None of the algorithms mentioned above" (the app already declares this).
4. They install the **TestFlight** app on their iPhone and tap **Install** next to Dawn Chorus.

Their iPhone needs **iOS 26 or newer**. The alarms use Apple's AlarmKit, which only exists from iOS 26.

## Later updates

When your kid sends you a new version of this folder, repeat steps 3 and 4 (and add your Team ID to the new `app.json` again). TestFlight builds expire after 90 days, so it needs a fresh build at least that often.

## If something goes wrong

- **The build fails with a Swift error** (in `DawnAlarmModule.swift`, `AlarmLiveActivity.swift` or `StopAlarmIntent.swift`): the alarm code was written on Windows and has never been compiled on a Mac, so the first build may hit a small error. Open the build link, copy the error text, and send it to your kid. They'll send back a fixed folder.
- **"Missing ios.appleTeamId"** or signing errors about **AlarmWidget**: check step 1, then run step 3 again.
- **Certificate or permission errors:** you need to be the account holder or an Admin on the Apple Developer team.
- **"You've reached your build limit":** Expo's free plan has a monthly limit; it resets at the start of the month.

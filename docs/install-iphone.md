# Getting Dawn Chorus onto your iPhone

This builds the real app (the one that can ring) in Expo's cloud, uploads it to Apple, and installs it on your phone through TestFlight. You don't need a Mac.

**You need:**
- An iPhone on **iOS 26 or newer** (Settings > General > About > iOS Version). AlarmKit, which lets the app ring like the Clock app, only exists from iOS 26.
- The Apple Developer account (the paid $99/year one), or a login with the right access to it. See "What the account holder does" below.
- Your free Expo account (you're already signed in to it on this PC).
- The **TestFlight** app from the App Store, on your iPhone.

## What the account holder does (send this to your dad)

There are two ways. Either is fine.

**Option A: you use his login.** He doesn't need to change anything. When the build asks you to sign in to Apple, you type his Apple ID and password, and Apple sends a 6-digit code to *his* devices, so he needs to read it to you. This happens on the first build; later builds reuse the saved certificates and may not ask again.

**Option B: he adds you to his team (better).** Then you sign in with your own Apple ID and he never has to send codes.

> Hi! I'm building a free alarm app and want to install it on my iPhone through TestFlight using your Apple Developer account. Could you please:
>
> 1. Go to https://appstoreconnect.apple.com, then **Users and Access**, then the **+** button.
> 2. Add my Apple ID email: **[your Apple ID email]**
> 3. Give me the **Admin** role. (Admin is needed so the build tool can create the signing certificate and app ID. If you'd rather not give Admin, give **App Manager** and tick **Access to Certificates, Identifiers & Profiles**; if the build still fails on certificates, you'll need to switch me to Admin or run the first build yourself.)
> 4. Under **Apps**, leave "All Apps" on.
> 5. Click **Invite**. I'll accept from the email.
>
> That's it. Nothing gets published on the App Store; it only goes to TestFlight for my own phone. Thanks!

## Build and upload (on this PC)

Open a terminal in the `app` folder of the project (`Documents\Bird Alarm\dawn-chorus\app`) and run these one at a time.

1. Install Expo's build tool (once):
   ```
   npm install --global eas-cli
   ```
2. Check you're signed in to Expo:
   ```
   eas whoami
   ```
   If it says you're not logged in, run `eas login`.
3. Link the project to your Expo account (once). Say **yes** when it offers to create a project:
   ```
   eas init
   ```
4. Build the iPhone app in the cloud:
   ```
   eas build --platform ios --profile production
   ```
   - It asks **"Do you want to log in to your Apple account?"**: say yes and sign in (your Apple ID if your dad added you, or his).
   - If you're on more than one team, pick your dad's team.
   - Say **yes** to letting it create a Distribution Certificate, Bundle Identifier and Provisioning Profile.
   - The build takes roughly 10–25 minutes. You can close the terminal; the link it prints shows progress in your browser.
5. Upload it to TestFlight:
   ```
   eas submit --platform ios --latest
   ```
   - Sign in to Apple again if it asks.
   - If it says the app doesn't exist in App Store Connect yet, let it create it. If the name "Dawn Chorus" is taken, change `"name"` in `app.json` (for example "Dawn Chorus Alarm") and build again.
   - Apple then processes the build, usually 10–30 minutes. You'll get an email when it's ready.

## Install it on your phone

1. Go to https://appstoreconnect.apple.com > **Apps** > **Dawn Chorus** > **TestFlight**.
2. Under **Internal Testing**, click **+** to make a group (call it anything), then add yourself as a tester (your Apple ID has to be a user on the team, see Option B; with Option A, add the Apple ID that's signed in on your iPhone if it's on the team, or ask your dad to add you).
3. Add the build to that group. If Apple asks about encryption, the app already declares it uses none.
4. On your iPhone, open the TestFlight email or the TestFlight app and tap **Install**.
5. Open Dawn Chorus, go to **Alarm**, and allow alarms when iOS asks. The Alarm screen should then say how many alarms are set.

**First test:** set an alarm for 3 minutes from now, lock the phone, and wait. Then try it with the ring switch on silent, with a Focus mode on, and after restarting the phone.

## Updating later

Every time you want the latest version on your phone, run steps 4 and 5 again (build, then submit). TestFlight shows the update in about half an hour. TestFlight builds expire after 90 days, so rebuild at least that often.

## What this first build does and doesn't do

- **Rings:** yes, through AlarmKit, with the Lock Screen and Dynamic Island alert and a Stop button.
- **Bird sound:** not yet. It plays the system alarm sound until bird recordings are added (that needs a free xeno-canto API key and ffmpeg). The bird card still shows who "woke you".
- **Snooze:** not yet. AlarmKit's snooze needs a Live Activity widget, which comes next.
- **Android:** not yet.

## If something goes wrong

- **Build fails with a Swift error in `DawnAlarmModule.swift`:** the AlarmKit code was written without a Mac to compile it on. Copy the error from the build page and paste it to Claude.
- **"Your team does not have permission" / certificate errors:** the Apple ID needs the Admin role, or the account holder runs step 4 once himself.
- **App installs but the Alarm screen says it isn't allowed:** Settings > Apps > Dawn Chorus > turn on Alarms.

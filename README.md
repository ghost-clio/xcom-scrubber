# 🧹 XCom Scrubber

**Safely bulk-delete posts from X Communities you admin.**

X discontinued creating new Communities, so people are recycling existing ones. This extension helps admins clean house — deleting old posts with human-like timing so you don't get flagged.

## Features

- **Human-like behavior** — Gaussian-distributed delays, natural scrolling, random breaks
- **Three speed modes** — Careful (🐢), Normal (🚶), Fast (🏃)
- **Session limits** — Auto-stops after 150-350 deletes to protect your account
- **Pause/Resume** — Stop anytime, pick up where you left off
- **Zero data collection** — No analytics, no external requests, no stored credentials
- **Open source** — Audit the code yourself

## Safety

- ✅ No external network requests — everything runs locally
- ✅ No access to cookies, tokens, or localStorage
- ✅ Only requests permission for x.com
- ✅ Content Security Policy blocks all remote scripts
- ✅ Built-in rate limiting protects your account
- ✅ Open source — verify everything

## Install

1. Clone this repo
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" → select this folder
5. Navigate to your X Community page
6. Click the extension icon → Start Scrubbing

## How it works

The extension interacts with the X Community page DOM just like you would manually:

1. Finds the three-dot menu on a post
2. Clicks it with slightly randomized coordinates
3. Clicks "Delete" from the menu
4. Confirms the deletion dialog
5. Waits a random human-like delay (3-14 seconds)
6. Takes periodic breaks (30-90 seconds every 10-40 deletes)
7. Stops after session limit to prevent detection

## Speed Profiles

| Profile | Delay | Breaks | Session Limit |
|---------|-------|--------|---------------|
| 🐢 Careful | 6-14s | Every 10-20 deletes, 30-90s break | 150 |
| 🚶 Normal | 3-8s | Every 15-30 deletes, 20-60s break | 250 |
| 🏃 Fast | 2-5s | Every 25-40 deletes, 10-30s break | 350 |

## License

MIT

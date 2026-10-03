# AGENTS.md

This file provides guidance to AI coding agents working with this repository.

## Project Overview

Zenhuman is a Chrome extension (Manifest V3) that modifies the Superhuman email client UI to provide a cleaner, calmer experience. It removes visual clutter like the right panel, tooltips, and notifications.

## Development

This is a vanilla JavaScript Chrome extension with no build step or dependencies; Chrome 116 or newer is required. To test changes:

1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. After code changes, click the refresh icon on the extension card

## Architecture

**Settings Flow:**
- User toggles settings via popup.html/popup.js
- Settings saved to `chrome.storage.sync`
- content.js listens for storage changes and applies CSS classes to `<html>` element
- styles.css uses those classes as selectors (e.g., `html.zh-hide-right-panel .layout-RightPane`)

**Key Files:**
- `manifest.json` - Extension configuration, permissions, content script registration
- `src/content.js` - Injected into Superhuman, manages CSS class toggles based on settings
- `src/styles.css` - All UI modifications via CSS rules gated by `zh-*` classes
- `src/popup.html` / `src/popup.js` - Extension popup UI for settings
- `src/settings.js` - Shared defaults; summaries start disabled
- `src/email-text.js` - Extracts email text from shadow roots or legacy iframes
- `src/summary-pane.js` - Focused-message detection, inline card, and navigation lifecycle
- `src/background.js` / `src/summary-api.js` - OpenAI requests, prompt, validation, and session cache
- `src/superhuman-cache.js` - MAIN-world adapter for cached presenters and queue neighbors; never invokes email loading or navigation
- `src/local-config.js` - Ignored personal API configuration; never read, print, commit, or distribute

**CSS Class Convention:**
All CSS modifications use classes prefixed with `zh-` (e.g., `zh-hide-right-panel`, `zh-compact-header`, `zh-hide-hint-tooltips`) applied to the document root element.

## Current Features

- `removeRightPanel` - Hides contact enrichment sidebar; reserves a back-button gutter in narrow email headers so the arrow and subject cannot overlap
- `compactHeader` - Smaller email headers, hides share/navigation buttons
- `hideHintTooltips` - Hides keyboard shortcut hints and notifications
- `simplerInboxZero` - Hides streak message, team button, referral/help/calendar icons on inbox zero screen
- `hideAchievementPopups` - Hides achievement popups like conversation-clearing milestones
- `summarizeEmails` - Collapsible plain-English summaries above focused emails over `summaryWordThreshold` words (default 200), using a choice of GPT-6 Luna, GPT-6.1 Sol (default), or GPT-6 Astra and the spirit of ASD-STE100. A nested settings menu offers Fast mode (default on), word threshold (default 200), and model selection. The prompt selects substantive takeaways before preserving their detail, omits peripheral author/publication metadata unless central, and uses up to five points without a filler quota. Points have short bold topic labels; summary text supports normal selection and copying. The header reads "Summarizing..." while loading and "Summary" when ready; loading uses a compact rotating header sparkle with reduced-motion support.
- **Cached queue prefetch** (automatic when summaries are enabled) - Prepares the next eligible cached message in each direction while reading. `src/superhuman-cache.js` runs in MAIN world and reads existing presenters/queue ranks only; no load methods, email navigation, or read-status changes. Scans at most five neighbors each way, skips missing bodies/drafts/removed conversations, and falls back to DOM summaries if internals change. Prefetch sends unread neighbor content to OpenAI and can incur charges even if those emails are never opened. The background allows one speculative request at a time, reserves foreground capacity, and deduplicates/promotes matching foreground requests.

**Summary Settings and Credentials:**
- The Carbon-theme newsletter sender keeps a dark foreground on its white message background, including when the email is below the summary threshold. Ordinary dark email headers retain their native colors.
- Toggles, model selection, and word threshold use `chrome.storage.sync`. Credentials use trusted extension contexts only, in `chrome.storage.local` or ignored `src/local-config.js`.
- Configure an API key through **Summary settings → Change API key** in the extension popup. Saving the key retries an open summary error through a credential-free notification; no reload is required.
- Requests time out after 25 seconds, before Chrome's 30-second service-worker fetch limit.
- Email text is sent only to the OpenAI Responses API when summaries are enabled. Requests use `store: false`; summaries are cached in `chrome.storage.session` until the browser session ends, with an in-page cache for immediate revisits. Both caches separate model and speed choices; preference changes refresh the focused email. Bump `PROMPT_VERSION` when changing the prompt to invalidate older summaries.
- Run `node scripts/test-browser.mjs` and open its localhost URL for browser integration checks. The server also offers `/popup` for an isolated settings preview and `/tests/background.html` for the production request/cache flow with mocked credentials and network. Use `/tests/prefetch.html` for bridge/queue integration checks. These fixtures mock Chrome APIs and cannot verify worker lifetimes or current Superhuman internals. Reload the extension and Superhuman for live verification.

## Documentation

When adding or modifying features, update both:
- This file (AGENTS.md) - Add to Current Features list
- README.md - Add to Features list

# AGENTS.md

This file provides guidance to AI coding agents working with this repository.

## Project Overview

Zenhuman is a Chrome extension (Manifest V3) that modifies the Superhuman email client UI to provide a cleaner, calmer experience. It removes visual clutter like the right panel, tooltips, and notifications.

## Development

This is a vanilla JavaScript Chrome extension with no build step or dependencies. To test changes:

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

**CSS Class Convention:**
All CSS modifications use classes prefixed with `zh-` (e.g., `zh-hide-right-panel`, `zh-compact-header`, `zh-hide-hint-tooltips`) applied to the document root element.

## Current Features

- `removeRightPanel` - Hides contact enrichment sidebar
- `compactHeader` - Smaller email headers, hides share/navigation buttons
- `hideHintTooltips` - Hides keyboard shortcut hints and notifications

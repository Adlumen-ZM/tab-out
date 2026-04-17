# Tab Out

**Keep tabs on your tabs.**

Tab Out is a Chrome extension that replaces your new tab page with a dashboard of everything you have open. Tabs are grouped by domain, with homepages (Gmail, X, LinkedIn, etc.) pulled into their own group. Close tabs with a satisfying swoosh + confetti.

No server. No account. Tab data and saved items stay in the extension. The optional **search bar** can query Google, Bing, or Baidu (with live suggestions) entirely in your browser—no Tab Out backend.

---

## Install with a coding agent

Send your coding agent (Claude Code, Codex, etc.) this repo and say **"install this"**:

```
https://github.com/Adlumen-ZM/tab-out
```

The agent will walk you through it. Takes about 1 minute.

---

## Features

- **See all your tabs at a glance** on a clean grid, grouped by domain
- **Homepages group** pulls Gmail inbox, X home, YouTube, LinkedIn, GitHub homepages into one card
- **Close tabs with style** with swoosh sound + confetti burst
- **Duplicate detection** flags when you have the same page open twice, with one-click cleanup
- **Click any tab to jump to it** across windows, no new tab opened
- **Save for later** bookmark tabs to a checklist before closing them
- **Localhost grouping** shows port numbers next to each tab so you can tell your vibe coding projects apart
- **Expandable groups** show the first 8 tabs with a clickable "+N more"
- **Appearance** — Light, Dark, or **System** theme (stored locally)
- **Color palettes** — Paper (default), Clay, Slate, Forest, and Noir, each tuned for light and dark mode
- **Integrated search** — search bar with Google / Bing / Baidu, debounced **query suggestions**, and navigation in the current tab
- **Tab Out tab hygiene** — banner when multiple Tab Out new-tab pages are open, with one-click cleanup
- **Optional local config** — drop `config.local.js` beside `app.js` if you need overrides (loaded only if present)
- **100% local dashboard** — open tabs and saved-for-later data stay in `chrome.storage.local`
- **Pure Chrome extension** no server, no Node.js, no npm, no setup beyond loading the extension

---

## Manual Setup

**1. Clone the repo**

```bash
git clone https://github.com/Adlumen-ZM/tab-out.git
```

**2. Load the Chrome extension**

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Navigate to the `extension/` folder inside the cloned repo and select it

**3. Open a new tab**

You'll see Tab Out.

---

## How it works

```
You open a new tab
  -> Tab Out shows your open tabs grouped by domain
  -> Homepages (Gmail, X, etc.) get their own group at the top
  -> Use the header search (optional) with your chosen engine + suggestions
  -> Click any tab title to jump to it
  -> Close groups you're done with (swoosh + confetti)
  -> Save tabs for later before closing them
```

Everything runs inside the Chrome extension. Saved tabs and preferences are stored in `chrome.storage.local`. Search requests go only to the search / suggestion hosts you select (Google, Bing, or Baidu).

---

## Tech stack

| What | How |
|------|-----|
| Extension | Chrome Manifest V3 |
| Storage | chrome.storage.local |
| Sound | Web Audio API (synthesized, no files) |
| Animations | CSS transitions + JS confetti particles |
| Theming | CSS custom properties + `color-mix` per palette |

---

## License

MIT

---

## Acknowledgments

Tab Out was originally created by **[Zara](https://x.com/zarazhangrui)**. Upstream project: **[zarazhangrui/tab-out](https://github.com/zarazhangrui/tab-out)**.

This repository ([**Adlumen-ZM/tab-out**](https://github.com/Adlumen-ZM/tab-out)) extends that base with the appearance, palette, search, and polish described above.

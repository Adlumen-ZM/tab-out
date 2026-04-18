/**
 * background.js — Service Worker for Badge Updates + startup pin
 *
 * Chrome's "always-on" background script for Tab Out.
 * - Keeps the toolbar badge showing the current open tab count.
 * - On each browser launch: dedupe extra Tab Out tabs per window (session restore + new tab),
 *   then pins one Tab Out if none pinned yet (skips pin if a pinned Tab Out already exists).
 *
 * The badge counts real web tabs (skipping chrome:// and extension pages).
 *
 * Color coding gives a quick at-a-glance health signal:
 *   Green  (#3d7a4a) → 1–10 tabs  (focused, manageable)
 *   Amber  (#b8892e) → 11–20 tabs (getting busy)
 *   Red    (#b35a5a) → 21+ tabs   (time to cull!)
 */

const TAB_OUT_PAGE_URL = () => chrome.runtime.getURL('index.html');

/**
 * Chrome often keeps the tab URL as chrome://newtab/ for overridden NTPs, while the
 * document is the extension page — so we must not match only chrome-extension://…/index.html.
 * @see https://developer.chrome.com/docs/extensions/mv3/override
 */
/**
 * Timing budgets (startup only — not animation/UI delays):
 * - Session-restore and NTP races usually settle within a few hundred ms; we use short
 *   staggered retries instead of one long wait so nothing feels “delayed.”
 * - Windows are hard caps so background work does not linger across the session.
 */
const PIN_WINDOW_MS = 2800;
const DEDUPE_WINDOW_MS = 2200;
/** Sub-second staggered passes (no intentional “pause” for the user). */
const STARTUP_RETRY_DELAYS_MS = [0, 80, 260, 700];

/** Stripped URL path for NTP host pages (override often still reports chrome://newtab, not chrome-extension://…). */
function isBrowserNewTabUrl(url) {
  if (!url) return false;
  const base = url.split(/[#?]/)[0];
  return (
    base === 'chrome://newtab' ||
    base === 'chrome://newtab/' ||
    base === 'edge://newtab' ||
    base === 'edge://newtab/' ||
    base === 'brave://newtab' ||
    base === 'brave://newtab/'
  );
}

function tabIsOurDashboard(tab) {
  if (!tab) return false;
  const u = tab.url || '';
  const pending = tab.pendingUrl || '';
  const ext = TAB_OUT_PAGE_URL();
  if (u === ext || pending === ext) return true;
  if (isBrowserNewTabUrl(u) || isBrowserNewTabUrl(pending)) return true;
  return false;
}

/**
 * Chrome restores pinned tabs from the previous session. If one is already our dashboard,
 * do not auto-pin again (avoids a second pinned Tab Out).
 */
async function skipAutoPinIfAlreadyPinnedFromLastSession() {
  try {
    if (!chrome.storage.session) return false;
    const pinned = await chrome.tabs.query({ pinned: true });
    if (!pinned.some(tabIsOurDashboard)) return false;
    await chrome.storage.session.set({ tabOutStartupPinned: true, tabOutPinDeadline: 0 });
    return true;
  } catch {
    return false;
  }
}

/** chrome.storage.session clears when the browser exits — perfect for "once per launch". */
async function beginStartupSessionWindows() {
  try {
    if (!chrome.storage.session) return;
    await chrome.storage.session.set({
      tabOutDedupeDeadline: Date.now() + DEDUPE_WINDOW_MS,
    });
    if (await skipAutoPinIfAlreadyPinnedFromLastSession()) return;
    await chrome.storage.session.set({
      tabOutPinDeadline: Date.now() + PIN_WINDOW_MS,
      tabOutStartupPinned: false,
    });
  } catch {
    /* ignore */
  }
}

/**
 * If multiple Tab Out pages exist in one window (e.g. session restore + Chrome opening another NTP),
 * keep a single tab: prefer pinned, then leftmost (restored tab is usually first).
 */
async function dedupeTabOutTabsOnStartup() {
  try {
    if (!chrome.storage.session) return;
    const s = await chrome.storage.session.get('tabOutDedupeDeadline');
    const ddl = s.tabOutDedupeDeadline;
    if (!ddl || Date.now() > ddl) return;

    const all = await chrome.tabs.query({});
    const ours = all.filter(tabIsOurDashboard);
    if (ours.length <= 1) return;

    const byWin = new Map();
    for (const t of ours) {
      if (!byWin.has(t.windowId)) byWin.set(t.windowId, []);
      byWin.get(t.windowId).push(t);
    }
    const toClose = [];
    for (const tabs of byWin.values()) {
      if (tabs.length <= 1) continue;
      tabs.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return a.index - b.index;
      });
      for (let i = 1; i < tabs.length; i++) toClose.push(tabs[i].id);
    }
    if (toClose.length) await chrome.tabs.remove(toClose);
  } catch {
    /* ignore */
  }
}

async function tryPinFirstTabOutTab(tabId) {
  try {
    if (!chrome.storage.session) return;
    if (await skipAutoPinIfAlreadyPinnedFromLastSession()) return;
    const tab = await chrome.tabs.get(tabId);
    if (!tabIsOurDashboard(tab)) return;
    const s = await chrome.storage.session.get(['tabOutPinDeadline', 'tabOutStartupPinned']);
    if (s.tabOutStartupPinned) return;
    const deadline = s.tabOutPinDeadline;
    if (!deadline || Date.now() > deadline) return;
    await chrome.tabs.update(tabId, { pinned: true });
    await chrome.storage.session.set({ tabOutStartupPinned: true, tabOutPinDeadline: 0 });
  } catch {
    /* ignore */
  }
}

async function pinExistingTabOutIfNeeded() {
  try {
    if (!chrome.storage.session) return;
    if (await skipAutoPinIfAlreadyPinnedFromLastSession()) return;
    const s = await chrome.storage.session.get(['tabOutPinDeadline', 'tabOutStartupPinned']);
    if (s.tabOutStartupPinned) return;
    const deadline = s.tabOutPinDeadline;
    if (!deadline || Date.now() > deadline) return;
    const allUnpinned = await chrome.tabs.query({ pinned: false });
    const candidates = allUnpinned.filter(tabIsOurDashboard);
    if (candidates.length === 0) return;
    candidates.sort((a, b) => (a.windowId - b.windowId) || (a.index - b.index));
    await chrome.tabs.update(candidates[0].id, { pinned: true });
    await chrome.storage.session.set({ tabOutStartupPinned: true, tabOutPinDeadline: 0 });
  } catch {
    /* ignore */
  }
}

// ─── Badge updater ────────────────────────────────────────────────────────────

/**
 * updateBadge()
 *
 * Counts open real-web tabs and updates the extension's toolbar badge.
 * "Real" tabs = not chrome://, not extension pages, not about:blank.
 */
async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});

    // Only count actual web pages — skip browser internals and extension pages
    const count = tabs.filter(t => {
      const url = t.url || '';
      return (
        !url.startsWith('chrome://') &&
        !url.startsWith('chrome-extension://') &&
        !url.startsWith('about:') &&
        !url.startsWith('edge://') &&
        !url.startsWith('brave://')
      );
    }).length;

    // Don't show "0" — an empty badge is cleaner
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });

    if (count === 0) return;

    // Pick badge color based on workload level
    let color;
    if (count <= 10) {
      color = '#3d7a4a'; // Green — you're in control
    } else if (count <= 20) {
      color = '#b8892e'; // Amber — things are piling up
    } else {
      color = '#b35a5a'; // Red — time to focus and close some tabs
    }

    await chrome.action.setBadgeBackgroundColor({ color });

  } catch {
    // If something goes wrong, clear the badge rather than show stale data
    chrome.action.setBadgeText({ text: '' });
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

function scheduleStartupDedupeAndPin() {
  const run = () => {
    void dedupeTabOutTabsOnStartup();
    void pinExistingTabOutIfNeeded();
  };
  for (const ms of STARTUP_RETRY_DELAYS_MS) setTimeout(run, ms);
}

// Update badge when the extension is first installed
chrome.runtime.onInstalled.addListener(details => {
  updateBadge();
  if (details.reason === 'install') {
    void beginStartupSessionWindows();
    scheduleStartupDedupeAndPin();
  }
});

// Update badge when Chrome starts up; dedupe then pin within short windows
chrome.runtime.onStartup.addListener(() => {
  updateBadge();
  void beginStartupSessionWindows();
  scheduleStartupDedupeAndPin();
});

// Update badge whenever a tab is opened
chrome.tabs.onCreated.addListener(() => {
  updateBadge();
  setTimeout(() => void dedupeTabOutTabsOnStartup(), 0);
});

// Update badge whenever a tab is closed
chrome.tabs.onRemoved.addListener(() => {
  updateBadge();
});

// Update badge when a tab's URL changes (e.g. navigating to/from chrome://)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  updateBadge();
  const maybeReady =
    changeInfo.status === 'complete' ||
    (changeInfo.url && tabIsOurDashboard(tab));
  if (!maybeReady) return;
  void dedupeTabOutTabsOnStartup();
  void tryPinFirstTabOutTab(tabId);
});

// ─── Initial run ─────────────────────────────────────────────────────────────

// Run once immediately when the service worker first loads
updateBadge();

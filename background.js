const STORAGE_KEY = "autoReloadTabs";
const LAST_RELOADS_KEY = "lastReloadTimes";
const ALARM_PREFIX = "auto-reload-";
const ALLOWED_INTERVALS = new Set([1, 2]);

function alarmName(tabId) {
  return `${ALARM_PREFIX}${tabId}`;
}

function normalizeInterval(value) {
  const interval = Number(value);
  return ALLOWED_INTERVALS.has(interval) ? interval : null;
}

async function getReloaders() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return stored[STORAGE_KEY] ?? {};
}

async function saveReloaders(reloaders) {
  await chrome.storage.local.set({ [STORAGE_KEY]: reloaders });
}

async function getLastReloads() {
  const stored = await chrome.storage.local.get(LAST_RELOADS_KEY);
  return stored[LAST_RELOADS_KEY] ?? {};
}

async function saveLastReloads(lastReloads) {
  await chrome.storage.local.set({ [LAST_RELOADS_KEY]: lastReloads });
}

async function ensureAlarm(tabId, interval) {
  const name = alarmName(tabId);
  const existing = await chrome.alarms.get(name);
  if (!existing || existing.periodInMinutes !== interval) {
    await chrome.alarms.create(name, {
      delayInMinutes: interval,
      periodInMinutes: interval
    });
  }
}

async function restoreAlarms() {
  const reloaders = await getReloaders();
  let changed = false;

  for (const [tabIdText, settings] of Object.entries(reloaders)) {
    const tabId = Number(tabIdText);
    const interval = normalizeInterval(settings?.interval);
    if (!Number.isInteger(tabId) || interval === null) {
      delete reloaders[tabIdText];
      changed = true;
      continue;
    }

    try {
      await chrome.tabs.get(tabId);
      await ensureAlarm(tabId, interval);
    } catch {
      await chrome.alarms.clear(alarmName(tabId));
      delete reloaders[tabIdText];
      changed = true;
    }
  }

  if (changed) await saveReloaders(reloaders);
}

chrome.runtime.onInstalled.addListener(() => {
  restoreAlarms().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  restoreAlarms().catch(() => {});
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;

  const tabId = Number(alarm.name.slice(ALARM_PREFIX.length));
  const reloaders = await getReloaders();
  const interval = normalizeInterval(reloaders[String(tabId)]?.interval);
  if (!Number.isInteger(tabId) || interval === null) {
    await chrome.alarms.clear(alarm.name);
    return;
  }

  try {
    const reloadedAt = Date.now();
    await chrome.tabs.reload(tabId);
    const lastReloads = await getLastReloads();
    lastReloads[String(tabId)] = reloadedAt;
    await saveLastReloads(lastReloads);
  } catch {
    await chrome.alarms.clear(alarm.name);
    delete reloaders[String(tabId)];
    await saveReloaders(reloaders);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const reloaders = await getReloaders();
  const lastReloads = await getLastReloads();
  const key = String(tabId);

  if (Object.hasOwn(reloaders, key)) {
    delete reloaders[key];
    await saveReloaders(reloaders);
  }

  if (Object.hasOwn(lastReloads, key)) {
    delete lastReloads[key];
    await saveLastReloads(lastReloads);
  }

  await chrome.alarms.clear(alarmName(tabId));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !["getStatus", "start", "stop"].includes(message.type)) {
    return false;
  }

  (async () => {
    const tabId = Number(message.tabId);
    if (!Number.isInteger(tabId) || tabId < 0) {
      throw new Error("Não encontrei uma aba válida para controlar.");
    }

    const reloaders = await getReloaders();
    const key = String(tabId);
    const lastReloads = await getLastReloads();
    const lastReloadAt = Number(lastReloads[key]) || null;

    if (message.type === "getStatus") {
      return {
        ok: true,
        interval: normalizeInterval(reloaders[key]?.interval),
        lastReloadAt
      };
    }

    if (message.type === "start") {
      const interval = normalizeInterval(message.interval);
      if (interval === null) {
        throw new Error("Escolha 1 ou 2 minutos.");
      }

      await chrome.tabs.get(tabId);
      reloaders[key] = { interval };
      await saveReloaders(reloaders);
      await ensureAlarm(tabId, interval);
      return { ok: true, interval, lastReloadAt };
    }

    delete reloaders[key];
    await saveReloaders(reloaders);
    await chrome.alarms.clear(alarmName(tabId));
    return { ok: true, interval: null, lastReloadAt };
  })()
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error?.message || "Não foi possível controlar esta aba."
      });
    });

  return true;
});

restoreAlarms().catch(() => {});

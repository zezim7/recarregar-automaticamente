const intervalSelect = document.querySelector("#interval");
const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");
const statusText = document.querySelector("#status");
const lastReloadText = document.querySelector("#last-reload");

let currentTabId = null;
let lastReloadAt = null;

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.dataset.error = String(isError);
}

async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) {
    throw new Error(response?.error || "Não foi possível concluir a ação.");
  }
  return response;
}

function showStatus(interval, lastReload = lastReloadAt) {
  lastReloadAt = lastReload;
  lastReloadText.textContent = lastReloadAt
    ? `Última recarga automática: ${new Date(lastReloadAt).toLocaleString("pt-BR")}`
    : "Última recarga automática: ainda não ocorreu.";

  if (interval) {
    intervalSelect.value = String(interval);
    setStatus(`Ativo nesta aba: recarrega a cada ${interval} minuto${interval === 1 ? "" : "s"}.`);
  } else {
    setStatus("Desativado nesta aba.");
  }
}

async function loadStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !Number.isInteger(tab.id)) {
      currentTabId = null;
      intervalSelect.disabled = true;
      startButton.disabled = true;
      stopButton.disabled = true;
      setStatus("Não encontrei uma aba ativa.", true);
      return;
    }

    currentTabId = tab.id;
    const response = await send({ type: "getStatus", tabId: currentTabId });
    showStatus(response.interval, response.lastReloadAt);
  } catch (error) {
    setStatus(error.message, true);
  }
}

startButton.addEventListener("click", async () => {
  if (currentTabId === null) return;
  startButton.disabled = true;
  try {
    const interval = Number(intervalSelect.value);
    const response = await send({ type: "start", tabId: currentTabId, interval });
    showStatus(interval, response.lastReloadAt);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    startButton.disabled = false;
  }
});

stopButton.addEventListener("click", async () => {
  if (currentTabId === null) return;
  stopButton.disabled = true;
  try {
    const response = await send({ type: "stop", tabId: currentTabId });
    showStatus(null, response.lastReloadAt);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    stopButton.disabled = false;
  }
});

loadStatus();

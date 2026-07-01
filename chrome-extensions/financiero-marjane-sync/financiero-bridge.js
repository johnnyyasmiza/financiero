const SOURCE_PAGE = "financiero";
const SOURCE_EXTENSION = "financiero-marjane-extension";
const PING = "FINANCIERO_MARJANE_SYNC_PING";
const READY = "FINANCIERO_MARJANE_SYNC_READY";
const REQUEST = "FINANCIERO_MARJANE_SYNC_REQUEST";
const RESPONSE = "FINANCIERO_MARJANE_SYNC_RESPONSE";

function postToPage(message) {
  window.postMessage({ source: SOURCE_EXTENSION, ...message }, window.location.origin);
}

postToPage({ type: READY });

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== SOURCE_PAGE) {
    return;
  }

  if (event.data.type === PING) {
    postToPage({ type: READY });
    return;
  }

  if (event.data.type !== REQUEST) {
    return;
  }

  const requestId = event.data.requestId;
  chrome.runtime.sendMessage({ type: "FETCH_MARJANE_LIST", requestId }, (response) => {
    if (chrome.runtime.lastError) {
      postToPage({
        type: RESPONSE,
        requestId,
        ok: false,
        error: chrome.runtime.lastError.message || "Extension Marjane indisponible.",
      });
      return;
    }

    postToPage({ type: RESPONSE, requestId, ...response });
  });
});

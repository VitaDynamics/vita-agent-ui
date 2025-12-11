const WebSocket = require("ws");

function logWithTimestamp(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function errorWithTimestamp(...args) {
  console.error(`[${new Date().toISOString()}]`, ...args);
}

function markAlive() {
  this.isAlive = true;
}

function safeSend(clientSocket, message) {
  if (clientSocket.readyState !== WebSocket.OPEN) return;

  try {
    clientSocket.send(message);
  } catch (err) {
    errorWithTimestamp("Failed to send message. Terminating socket.", err);
    try {
      clientSocket.terminate();
    } catch (terminateErr) {
      errorWithTimestamp(
        "Failed to terminate socket after send error.",
        terminateErr
      );
    }
  }
}

function terminateAndCleanup(client, clientsMap, wssInstance, options = {}) {
  const { logMessage, terminationErrorMessage } = options;
  const clientInfo = clientsMap.get(client);

  if (logMessage) {
    logWithTimestamp(
      `${logMessage}: ${clientInfo?.id || "unknown"}. Terminating.`
    );
  }

  try {
    client.terminate();
  } catch (err) {
    errorWithTimestamp(
      terminationErrorMessage || "Failed to terminate client",
      err
    );
  }

  clientsMap.delete(client);
  if (clientInfo && clientInfo.type === "source") {
    broadcastClientList(wssInstance, clientsMap);
  }
}

function getActiveSources(clients) {
  return Array.from(clients.values())
    .filter((info) => info.type === "source")
    .map(({ id, name }) => ({ id, name }));
}

function sendClientListTo(clientSocket, clients) {
  const message = JSON.stringify({
    type: "client_list",
    clients: getActiveSources(clients),
  });

  safeSend(clientSocket, message);
}

function broadcastClientList(wss, clients) {
  const message = JSON.stringify({
    type: "client_list",
    clients: getActiveSources(clients),
  });

  wss.clients.forEach((client) => {
    safeSend(client, message);
  });
}

function formatMessageForLog(data) {
  return JSON.stringify(data, (key, value) => {
    if (
      key === "image_base64" &&
      typeof value === "string" &&
      value.length > 50
    ) {
      return value.substring(0, 20) + "...[TRUNCATED]";
    }
    return value;
  });
}

async function attachImageFromUrl(data, logger, errorLogger) {
  if (data.type !== "ui_event" || !data.event || !data.event.image_url) {
    return;
  }

  // Let the frontend render the remote image directly to avoid download + base64 overhead.
  logger(`Passing through image_url without fetching: ${data.event.image_url}`);
}

module.exports = {
  logWithTimestamp,
  errorWithTimestamp,
  markAlive,
  safeSend,
  sendClientListTo,
  broadcastClientList,
  formatMessageForLog,
  attachImageFromUrl,
  terminateAndCleanup,
};


const $ = (id) => document.getElementById(id);
const video = $("video");
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const btnStart = $("btnStart");
const btnStop = $("btnStop");
const toggleSend = $("toggleSend");
const statusPill = $("statusPill");
const gestureLabel = $("gestureLabel");
const gestureHint = $("gestureHint");
const textInput = $("textInput");
const btnRender = $("btnRender");
const cards = $("cards");

let stream = null;
let ws = null;
let timer = null;
let lastLabel = null;
let reconnectTimer = null;

function setStatus(state, text) {
  statusPill.classList.remove("ok", "bad");
  if (state === "ok") statusPill.classList.add("ok");
  if (state === "bad") statusPill.classList.add("bad");
  statusPill.textContent = text;
}

function connectWs() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws/gesture`);

  ws.onopen = () => {
    setStatus("ok", "Connected");
    gestureHint.textContent = "Camera ready. Showing live results…";
  };

  ws.onclose = () => {
    setStatus("bad", "Disconnected");
    if (stream) {
      gestureHint.textContent = "Connection lost. Reconnecting…";
      reconnectTimer = setTimeout(connectWs, 2000);
    }
  };

  ws.onerror = () => {
    setStatus("bad", "WebSocket Error");
  };

  ws.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data);
      if (!data.ok) return;
      const label = data.label || "—";
      gestureLabel.textContent = label;
      if (label !== "—" && label !== lastLabel) lastLabel = label;
    } catch (_) {}
  };
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Your browser does not support camera access. Use Chrome or Firefox over HTTPS.");
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: false,
    });
  } catch (hdErr) {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }

  video.srcObject = stream;
  await video.play();

  btnStart.disabled = true;
  btnStop.disabled = false;

  if (!ws || ws.readyState !== WebSocket.OPEN) connectWs();

  timer = setInterval(() => {
    if (!toggleSend.checked) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (video.readyState < 2) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    canvas.width = 480;
    canvas.height = Math.round((480 * h) / w);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    ws.send(dataUrl);
  }, 160);
}

function stopCamera() {
  if (timer) { clearInterval(timer); timer = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  if (ws) { ws.close(); ws = null; }
  video.srcObject = null;
  btnStart.disabled = false;
  btnStop.disabled = true;
  gestureLabel.textContent = "—";
  gestureHint.textContent = "Camera stopped.";
  setStatus("bad", "Disconnected");
}

function renderCards(text) {
  cards.innerHTML = "";
  const chars = Array.from(text.toUpperCase());
  for (const ch of chars) {
    const safe = ch === " " ? "SPACE" : ch;
    const filename = encodeURIComponent(safe) + ".png";
    const imgPath = `/static/signs/${filename}`;
    const el = document.createElement("div");
    el.className = "sign-card";
    el.innerHTML = `
      <img src="${imgPath}" alt="${safe}" onerror="this.src='/static/signs/UNKNOWN.png'" />
      <div class="cap">${safe}</div>
    `;
    cards.appendChild(el);
  }
}

btnStart.addEventListener("click", async () => {
  try {
    setStatus("", "Connecting…");
    gestureHint.textContent = "Requesting camera permission…";
    await startCamera();
  } catch (e) {
    setStatus("bad", "Camera blocked");
    if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
      gestureHint.textContent =
        "❌ Camera permission denied. Click the 🔒 lock icon in your browser's address bar → set Camera to Allow → reload the page.";
    } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
      gestureHint.textContent =
        "❌ No camera found. Make sure a camera is connected and not being used by another app.";
    } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
      gestureHint.textContent =
        "❌ Camera is already in use by another app (Zoom, Teams, etc.). Close that app and try again.";
    } else if (e.name === "OverconstrainedError") {
      gestureHint.textContent =
        "❌ Camera doesn't support the requested resolution. Try a different browser.";
    } else if (e.message && e.message.includes("does not support")) {
      gestureHint.textContent = e.message;
    } else {
      gestureHint.textContent = `❌ Camera error: ${e.message}. Make sure you're using HTTPS and allow camera access.`;
    }
  }
});

btnStop.addEventListener("click", stopCamera);

btnRender.addEventListener("click", () => {
  renderCards(textInput.value || "");
});

textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") renderCards(textInput.value || "");
});

setStatus("bad", "Disconnected");
gestureHint.textContent = "Click 'Start camera' to begin.";
// ── Voice to Text ─────────────────────────────────────────
const btnMic = document.getElementById("btnMic");
const voiceOutput = document.getElementById("voiceOutput");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  btnMic.disabled = true;
  voiceOutput.textContent = "❌ Your browser does not support voice recognition. Use Chrome.";
} else {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    voiceOutput.textContent = transcript;
  };

  recognition.onerror = (event) => {
    voiceOutput.textContent = `❌ Mic error: ${event.error}. Allow microphone and use Chrome.`;
  };

  recognition.onend = () => {
    btnMic.textContent = "🎤 Start Voice";
  };

  let micActive = false;

  btnMic.addEventListener("click", () => {
    if (!micActive) {
      recognition.start();
      btnMic.textContent = "🔴 Stop Voice";
      micActive = true;
    } else {
      recognition.stop();
      btnMic.textContent = "🎤 Start Voice";
      micActive = false;
    }
  });
}

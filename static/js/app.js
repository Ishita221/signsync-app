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

function setStatus(state, text) {
  statusPill.classList.remove("ok", "bad");
  if (state === "ok") statusPill.classList.add("ok");
  if (state === "bad") statusPill.classList.add("bad");
  statusPill.textContent = text;
}

function connectWs() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws/gesture`);

  ws.onopen = () => {
    setStatus("ok", "Connected");
    gestureHint.textContent = "Camera ready. Showing live results…";
  };

  ws.onclose = () => {
    setStatus("bad", "Disconnected");
  };

  ws.onerror = () => {
    setStatus("bad", "Error");
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
  stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();

  btnStart.disabled = true;
  btnStop.disabled = false;

  if (!ws || ws.readyState !== WebSocket.OPEN) connectWs();

  // send ~6 fps
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
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  btnStart.disabled = false;
  btnStop.disabled = true;
  gestureHint.textContent = "Camera stopped.";
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
    await startCamera();
  } catch (e) {
    setStatus("bad", "Camera blocked");
    gestureHint.textContent =
      "Camera permission denied. Allow camera access in your browser and Windows settings.";
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


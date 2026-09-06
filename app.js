const LISTS = [
  { name: "Clothing List", icon: "\uD83D\uDC55", docId: "1UPWfgSclFkAUrOuqdIFgIPPEj2Ya832KlKo4irq-ksU" },
  { name: "Vinyl List", icon: "\uD83D\uDCFB", docId: "1Sw2oYp935Jqc8Hmk4yyOZxfB__s8mBqaErd03SxalWI" },
  { name: "Other / Furniture", icon: "\uD83D\uDECF\uFE0F", docId: "1DA6UydLaIte8l1cBUybZPZvJYqcqNhC5uYo47FIbhrY" },
  { name: "Music Utility", icon: "\uD83C\uDFB5", docId: "10xOzhFJUi-3q7_he0kJbG3UeJex5xBWq4jR5SnuzP_k" },
];

const $ = (id) => document.getElementById(id);

/* ---------- music player ---------- */
const SONGS = [
  { name: "AURORA", file: "AURORA.mp3" },
  { name: "Action Bronson - Tank", file: "Action Bronson - TANK (feat. Big Body Bes).mp3" },
  { name: "Flying Trapeze Act", file: "Flying Trapeze Act.mp3" },
  { name: "Freestyle 4", file: "Freestyle 4.mp3" },
  { name: "Nujabes - Counting Stars", file: "Nujabes  - Counting Stars  [Official Audio].mp3" },
  { name: "Shit I'm On", file: "Shit I’m On.mp3" },
  { name: "Westside Gunn & Joey Bada$$ - 327", file: "Westside Gunn & Joey Bada$$ - 327 (ft. Tyler, The Creator & Billie Essco) (Audio).mp3" },
  { name: "Westside Gunn - Suicide in Selfridges", file: "Westside Gunn, DJ Drama - Suicide in Selfridges (Official Visualizer) 4.mp3" },
];

const welcomeSpanEl = $("marqueeText");
let playOrder = [];
let playIndex = 0;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function startPlaylist() {
  playOrder = shuffle([...SONGS]);
  playIndex = 0;
  playSong();
}

let audio = new Audio();
audio.addEventListener("ended", nextSong);

/* ---- audio-reactive visualizer ---- */
let audioCtx = null;
let analyser = null;
let freqData = null;

function ensureAudioGraph() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.55;
  freqData = new Uint8Array(analyser.frequencyBinCount);
  const src = audioCtx.createMediaElementSource(audio);
  src.connect(analyser);
  analyser.connect(audioCtx.destination);
}

// Autoplay policies keep the AudioContext suspended until a user gesture.
function unlockAudio() {
  if (!audioCtx) ensureAudioGraph();
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  audio.play().catch(() => {});
}
window.addEventListener("pointerdown", unlockAudio, { once: true });
window.addEventListener("keydown", unlockAudio, { once: true });

const viz = $("viz");
const vizCtx = viz.getContext("2d");
let vizW = 0, vizH = 0;
function sizeViz() {
  vizW = viz.clientWidth;
  vizH = viz.clientHeight;
  viz.width = vizW * (window.devicePixelRatio || 1);
  viz.height = vizH * (window.devicePixelRatio || 1);
  vizCtx.setTransform((window.devicePixelRatio || 1), 0, 0, (window.devicePixelRatio || 1), 0, 0);
}
sizeViz();
window.addEventListener("resize", sizeViz);

const BARS = 48;
const BAR_COLORS = ["#00e5ff", "#00b7ff", "#00d9a3", "#7dfcff", "#4dc3ff"];

function drawViz(time) {
  requestAnimationFrame(drawViz);
  if (vizW === 0) return;
  vizCtx.clearRect(0, 0, vizW, vizH);
  let levels = new Array(BARS);
  if (analyser && audioCtx && audioCtx.state === "running") {
    analyser.getByteFrequencyData(freqData);
    // skip the lowest bins, cover the song's range across the bars
    const step = Math.max(1, Math.floor(freqData.length * 0.75 / BARS));
    for (let i = 0; i < BARS; i++) {
      let sum = 0, n = 0;
      for (let k = 0; k < step; k++) {
        sum += freqData[i * step + k];
        n++;
      }
      levels[i] = sum / n / 255; // 0..1
    }
  } else {
    // gentle idle motion so the strip still feels alive
    for (let i = 0; i < BARS; i++) {
      levels[i] = Math.max(0, 0.12 + 0.1 * Math.sin(i * 0.9 + time * 0.004));
    }
  }

  const gap = 3;
  const barW = (vizW - gap * (BARS - 1)) / BARS;
  const baseY = vizH - 4;
  for (let i = 0; i < BARS; i++) {
    const v = Math.pow(Math.min(1, levels[i]), 1.5);
    const h = Math.max(4, v * (vizH - 12));
    const g = vizCtx.createLinearGradient(0, baseY, 0, baseY - h);
    g.addColorStop(0, BAR_COLORS[i % BAR_COLORS.length]);
    g.addColorStop(1, "#fff");
    vizCtx.fillStyle = g;
    vizCtx.fillRect(i * (barW + gap), baseY - h, barW, h);
  }
}
requestAnimationFrame(drawViz);

function playSong() {
  const song = playOrder[playIndex];
  nowPlayingText = "NOW PLAYING - " + song.name;
  cycleId = 0;
  showMarquee(nowPlayingText);
  audio.src = song.file;
  ensureAudioGraph();
  audio.play().then(() => setPlaying(true)).catch(() => {});
}

const WELCOME_TEXT = "WELCOME TO THE HOLIDAY LISTS &nbsp;\u2605&nbsp; PICK A LIST &nbsp;\u2605&nbsp; ADD TO THE WISH LIST AT THE BOTTOM &nbsp;\u2605&nbsp; IT SAVES ITSELF &nbsp;\u2605";
let nowPlayingText = "";
let cycleId = 0;

const SCROLL_SPEED = 80; // px per second when entering from the right
function showMarquee(text) {
  cycleId++; // alternate between "now playing" and "welcome"
  welcomeSpanEl.innerHTML = text;
  welcomeSpanEl.style.animation = "none";
  // measure the text so the scroll duration clears the screen cleanly
  const w = welcomeSpanEl.scrollWidth;
  welcomeSpanEl.style.animation = "";
  const dur = (w + window.innerWidth) / SCROLL_SPEED;
  welcomeSpanEl.style.animation = `scroll ${dur}s linear forwards`;
}

welcomeSpanEl.addEventListener("animationend", () => {
  // when the text has fully scrolled off the left, show the other message
  showMarquee(cycleId % 2 === 1 ? WELCOME_TEXT : nowPlayingText);
});

function nextSong() {
  playIndex++;
  if (playIndex >= playOrder.length) {
    playOrder = shuffle([...SONGS]);
    playIndex = 0;
  }
  playSong();
}

function prevSong() {
  // jump to previous track (restart if near the beginning)
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    playSong();
    return;
  }
  playIndex--;
  if (playIndex < 0) {
    playIndex = playOrder.length - 1;
  }
  playSong();
}

let isPlaying = false;
const playPauseBtn = $("playPauseBtn");
function setPlaying(p) {
  isPlaying = p;
  playPauseBtn.innerHTML = p ? "&#9632; Pause" : "&#9654; Play";
}
$("playPauseBtn").addEventListener("click", () => {
  unlockAudio();
  if (isPlaying) {
    audio.pause();
    setPlaying(false);
  } else {
    audio.play().then(() => setPlaying(true)).catch(() => {});
  }
});
$("nextBtn").addEventListener("click", () => { unlockAudio(); nextSong(); });
$("prevBtn").addEventListener("click", () => { unlockAudio(); prevSong(); });

audio.addEventListener("play", () => setPlaying(true));
audio.addEventListener("pause", () => setPlaying(false));

// delay so the "welcome" message shows on first paint
setTimeout(startPlaylist, 800);

/* ---- collapse the bottom UI ---- */
const bottomBar = $("bottomBar");
const collapseBtn = $("collapseBtn");
$("collapseBtn").addEventListener("click", () => {
  bottomBar.classList.toggle("minimized");
  collapseBtn.innerHTML = bottomBar.classList.contains("minimized")
    ? "Wishlist &#9650;"
    : "Wishlist &#9660;";
});

const menuGrid = $("menuGrid");
const menu = $("menu");
const docview = $("docview");
const docTitle = $("docTitle");
const docContent = $("docContent");
const backBtn = $("backBtn");

function buildMenu() {
  menuGrid.innerHTML = "";
  for (const list of LISTS) {
    const card = document.createElement("button");
    card.className = "menu-card raised";
    card.innerHTML =
      `<span class="card-icon">${list.icon}</span>` +
      `<span class="card-name">${list.name}</span>` +
      `<span class="card-count">view list</span>`;
    card.addEventListener("click", () => openDoc(list));
    menuGrid.appendChild(card);
  }
}

function openDoc(list) {
  docTitle.textContent = list.name;
  const url = `https://docs.google.com/document/d/${list.docId}/preview`;
  docContent.innerHTML =
    `<iframe class="doc-frame" src="${url}" title="${list.name}" loading="lazy"></iframe>`;
  menu.classList.add("hidden");
  docview.classList.remove("hidden");
}

backBtn.addEventListener("click", () => {
  docview.classList.add("hidden");
  menu.classList.remove("hidden");
});

/* ---------- persistent wish list ---------- */
const WISH_KEY = "holidayWishList";
const wishInput = $("wishInput");
const wishAdd = $("wishAdd");
const wishList = $("wishList");
const wishCount = $("wishCount");
const wishWin = $("wishWin");
const wishClose = $("wishClose");
const wishMin = $("wishMin");
let wishes = [];

function loadWishes() {
  try {
    const raw = localStorage.getItem(WISH_KEY);
    wishes = raw ? JSON.parse(raw) : [];
  } catch {
    wishes = [];
  }
}

function saveWishes() {
  localStorage.setItem(WISH_KEY, JSON.stringify(wishes));
}

function renderWishes() {
  wishList.innerHTML = "";
  wishCount.textContent = wishes.length;
  if (wishes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "wishbar-empty";
    empty.textContent = "Nothing here yet. Type something you want above.";
    wishList.appendChild(empty);
    return;
  }
  wishes.forEach((item, i) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = item;
    const del = document.createElement("button");
    del.className = "wish-del";
    del.textContent = "X";
    del.title = "Remove";
    del.addEventListener("click", () => {
      wishes.splice(i, 1);
      saveWishes();
      renderWishes();
    });
    li.appendChild(span);
    li.appendChild(del);
    wishList.appendChild(li);
  });
}

function openWishWindow() {
  wishWin.classList.remove("minimized");
  wishWin.style.display = "flex";
  // position near bottom-right, above the wishbar
  const barH = wishbar.offsetHeight;
  wishWin.style.left = Math.max(12, window.innerWidth - wishWin.offsetWidth - 16) + "px";
  wishWin.style.top = Math.max(12, window.innerHeight - barH - wishWin.offsetHeight - 16) + "px";
}

wishAdd.addEventListener("click", addWish);
wishInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addWish();
});

function addWish() {
  const val = wishInput.value.trim();
  if (!val) return;
  wishes.push(val);
  wishInput.value = "";
  saveWishes();
  renderWishes();
  openWishWindow();
  wishInput.focus();
}

wishClose.addEventListener("click", () => {
  wishWin.classList.add("minimized");
  wishWin.style.display = "none";
});
wishMin.addEventListener("click", () => {
  wishWin.classList.add("minimized");
  wishWin.style.display = "none";
});

/* ---- drag window ---- */
const winTitlebar = wishWin.querySelector(".win-titlebar");
let dragging = false, dragOffsetX = 0, dragOffsetY = 0;
winTitlebar.addEventListener("mousedown", (e) => {
  if (e.target.closest(".win-controls")) return;
  dragging = true;
  dragOffsetX = e.clientX - wishWin.offsetLeft;
  dragOffsetY = e.clientY - wishWin.offsetTop;
  wishWin.style.left = wishWin.offsetLeft + "px";
  wishWin.style.top = wishWin.offsetTop + "px";
});
document.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  wishWin.style.left = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dragOffsetX)) + "px";
  wishWin.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragOffsetY)) + "px";
});
document.addEventListener("mouseup", () => { dragging = false; });

const wishbar = document.querySelector(".wishbar");

loadWishes();
renderWishes();
buildMenu();
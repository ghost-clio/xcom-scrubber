// XCom Scrubber — Popup Controller
// Zero external requests. All communication via chrome.tabs.sendMessage.

const SPEED_PROFILES = {
  careful: { minDelay: 6000, maxDelay: 14000, breakEvery: [10, 20], breakDuration: [30000, 90000], sessionLimit: 150 },
  normal:  { minDelay: 3000, maxDelay: 8000,  breakEvery: [15, 30], breakDuration: [20000, 60000], sessionLimit: 250 },
  fast:    { minDelay: 2000, maxDelay: 5000,  breakEvery: [25, 40], breakDuration: [10000, 30000], sessionLimit: 350 },
};

let currentSpeed = 'normal';
let state = { deleted: 0, failed: 0, session: 0, running: false, paused: false };

document.addEventListener('DOMContentLoaded', async () => {
  // Check if we're on a community page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';
  
  if (!url.includes('x.com/i/communities/')) {
    document.getElementById('not-community').style.display = 'block';
    document.getElementById('main-ui').style.display = 'none';
    return;
  }

  // Speed buttons
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSpeed = btn.dataset.speed;
      sendToContent({ type: 'SET_SPEED', speed: currentSpeed, profile: SPEED_PROFILES[currentSpeed] });
    });
  });

  // Start button
  document.getElementById('start-btn').addEventListener('click', () => {
    state.running = true;
    state.paused = false;
    updateUI();
    sendToContent({ type: 'START', speed: currentSpeed, profile: SPEED_PROFILES[currentSpeed] });
  });

  // Pause button
  document.getElementById('pause-btn').addEventListener('click', () => {
    state.paused = !state.paused;
    document.getElementById('pause-btn').textContent = state.paused ? 'Resume' : 'Pause';
    sendToContent({ type: state.paused ? 'PAUSE' : 'RESUME' });
  });

  // Stop button
  document.getElementById('stop-btn').addEventListener('click', () => {
    state.running = false;
    state.paused = false;
    updateUI();
    sendToContent({ type: 'STOP' });
  });

  // Listen for status updates from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STATUS') {
      state.deleted = msg.deleted || 0;
      state.failed = msg.failed || 0;
      state.session = msg.session || 0;
      state.running = msg.running || false;
      if (msg.sessionLimit && msg.session >= msg.sessionLimit) {
        state.running = false;
      }
      updateUI();
    }
  });

  // Get initial state
  sendToContent({ type: 'GET_STATUS' });
});

function updateUI() {
  document.getElementById('deleted-count').textContent = state.deleted;
  document.getElementById('failed-count').textContent = state.failed;
  document.getElementById('session-count').textContent = state.session;

  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const stopBtn = document.getElementById('stop-btn');

  if (state.running) {
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'block';
    stopBtn.style.display = 'block';
  } else {
    startBtn.style.display = 'block';
    pauseBtn.style.display = 'none';
    stopBtn.style.display = 'none';
    startBtn.textContent = state.session > 0 ? 'Resume Scrubbing' : 'Start Scrubbing';
  }
}

async function sendToContent(msg) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
  }
}

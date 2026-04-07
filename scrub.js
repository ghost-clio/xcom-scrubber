// XCom Scrubber — Bookmarklet payload
// This is the code that runs on x.com/i/communities/* pages
// Zero external requests. DOM-only. Runs entirely in the user's browser.

(function() {
  'use strict';

  // Bail if not on a community page
  if (!window.location.href.includes('x.com/i/communities/')) {
    alert('⚠️ Navigate to an X Community page first!\n\nhttps://x.com/i/communities/...');
    return;
  }

  // Bail if already running
  if (window.__xcomScrubber) {
    if (window.__xcomScrubber.running) {
      window.__xcomScrubber.stop();
      return;
    }
  }

  // === UI OVERLAY ===
  const overlay = document.createElement('div');
  overlay.id = 'xcom-scrubber-ui';
  overlay.innerHTML = `
    <style>
      #xcom-scrubber-ui {
        position: fixed; top: 16px; right: 16px; z-index: 999999;
        background: #16181c; border: 1px solid #333639; border-radius: 16px;
        padding: 16px; width: 280px; font-family: -apple-system, sans-serif;
        color: #e7e9ea; box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        cursor: move; user-select: none;
      }
      #xcom-scrubber-ui * { box-sizing: border-box; }
      .xs-title { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
      .xs-sub { font-size: 11px; color: #71767b; margin-bottom: 12px; }
      .xs-stats { display: flex; gap: 8px; margin-bottom: 12px; }
      .xs-stat { flex: 1; background: #0a0a0a; border-radius: 8px; padding: 8px; text-align: center; }
      .xs-stat-n { font-size: 20px; font-weight: 700; }
      .xs-stat-l { font-size: 9px; color: #71767b; text-transform: uppercase; }
      .xs-log { background: #0a0a0a; border-radius: 8px; padding: 8px; height: 80px;
        overflow-y: auto; font-size: 11px; color: #71767b; margin-bottom: 12px;
        font-family: monospace; line-height: 1.5; }
      .xs-speeds { display: flex; gap: 6px; margin-bottom: 12px; }
      .xs-speed { flex: 1; padding: 6px; border: 1px solid #333639; border-radius: 8px;
        background: transparent; color: #e7e9ea; font-size: 11px; cursor: pointer; text-align: center; }
      .xs-speed:hover { border-color: #1d9bf0; }
      .xs-speed.active { background: #1d9bf0; border-color: #1d9bf0; }
      .xs-btn { width: 100%; padding: 10px; border: none; border-radius: 20px;
        font-size: 14px; font-weight: 700; cursor: pointer; margin-bottom: 6px; }
      .xs-start { background: #1d9bf0; color: white; }
      .xs-start:hover { background: #1a8cd8; }
      .xs-pause { background: #f7931a; color: white; }
      .xs-stop { background: #f4212e; color: white; display: none; }
      .xs-close { position: absolute; top: 8px; right: 12px; background: none;
        border: none; color: #71767b; font-size: 18px; cursor: pointer; }
      .xs-close:hover { color: #e7e9ea; }
      .xs-warn { font-size: 10px; color: #71767b; text-align: center; margin-top: 6px; }
      .xs-status { font-size: 12px; color: #1d9bf0; text-align: center; margin-bottom: 8px; min-height: 16px; }
    </style>
    <button class="xs-close" id="xs-close">✕</button>
    <div class="xs-title">🧹 XCom Scrubber</div>
    <div class="xs-sub">Community post cleaner</div>
    <div class="xs-status" id="xs-status">Ready</div>
    <div class="xs-stats">
      <div class="xs-stat"><div class="xs-stat-n" id="xs-deleted">0</div><div class="xs-stat-l">Deleted</div></div>
      <div class="xs-stat"><div class="xs-stat-n" id="xs-skipped">0</div><div class="xs-stat-l">Skipped</div></div>
      <div class="xs-stat"><div class="xs-stat-n" id="xs-session">0</div><div class="xs-stat-l">Session</div></div>
    </div>
    <div class="xs-log" id="xs-log"></div>
    <div class="xs-speeds">
      <button class="xs-speed" data-speed="careful">🐢 Careful</button>
      <button class="xs-speed active" data-speed="normal">🚶 Normal</button>
      <button class="xs-speed" data-speed="fast">🏃 Fast</button>
    </div>
    <button class="xs-btn xs-start" id="xs-start">Start Scrubbing</button>
    <button class="xs-btn xs-stop" id="xs-stop">Stop</button>
    <div class="xs-warn">Runs in your browser. No data sent anywhere.</div>
  `;
  document.body.appendChild(overlay);

  // Make draggable
  let isDragging = false, dragX, dragY;
  overlay.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    dragX = e.clientX - overlay.offsetLeft;
    dragY = e.clientY - overlay.offsetTop;
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    overlay.style.left = (e.clientX - dragX) + 'px';
    overlay.style.right = 'auto';
    overlay.style.top = (e.clientY - dragY) + 'px';
  });
  document.addEventListener('mouseup', () => isDragging = false);

  // === SPEED PROFILES ===
  const SPEEDS = {
    careful: { min: 6000, max: 14000, breakEvery: [10, 20], breakLen: [30000, 90000], limit: 150 },
    normal:  { min: 3000, max: 8000,  breakEvery: [15, 30], breakLen: [20000, 60000], limit: 250 },
    fast:    { min: 2000, max: 5000,  breakEvery: [25, 40], breakLen: [10000, 30000], limit: 350 },
  };
  let spd = SPEEDS.normal;

  // Speed buttons
  overlay.querySelectorAll('.xs-speed').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.xs-speed').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      spd = SPEEDS[btn.dataset.speed];
      log('Speed: ' + btn.textContent.trim());
    });
  });

  // === HELPERS ===
  const $ = (s) => overlay.querySelector(s);
  let deleted = 0, skipped = 0, session = 0;

  function updateStats() {
    $('#xs-deleted').textContent = deleted;
    $('#xs-skipped').textContent = skipped;
    $('#xs-session').textContent = session;
  }

  function log(msg) {
    const el = $('#xs-log');
    const line = document.createElement('div');
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    line.textContent = `[${time}] ${msg}`;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  function setStatus(s) { $('#xs-status').textContent = s; }

  function gauss(min, max) {
    const u1 = Math.random(), u2 = Math.random();
    const n = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return min + Math.max(0, Math.min(1, (n + 3) / 6)) * (max - min);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function click(el) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2 + gauss(-2, 2);
    const y = r.top + r.height / 2 + gauss(-2, 2);
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 }));
    }
  }

  function dismiss() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  }

  // === CORE LOGIC ===
  const scrubber = {
    running: false,

    async deleteOne() {
      // Find post menu buttons (three dots)
      const carets = document.querySelectorAll('[data-testid="caret"]');
      if (carets.length === 0) {
        window.scrollBy({ top: gauss(300, 600), behavior: 'smooth' });
        await sleep(gauss(1500, 3000));
        return 'scrolled';
      }

      const btn = carets[0];
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(gauss(400, 900));

      click(btn);
      await sleep(gauss(600, 1400));

      // Find delete/remove option
      let delOpt = null;
      for (const item of document.querySelectorAll('[role="menuitem"]')) {
        const t = (item.textContent || '').toLowerCase();
        if (t.includes('delete') || t.includes('remove')) { delOpt = item; break; }
      }

      if (!delOpt) {
        dismiss();
        await sleep(gauss(300, 700));
        skipped++;
        return 'skipped';
      }

      click(delOpt);
      await sleep(gauss(700, 1500));

      // Confirm
      let confirm = document.querySelector('[data-testid="confirmationSheetConfirm"]');
      if (!confirm) {
        for (const b of document.querySelectorAll('[role="button"]')) {
          if (b.textContent?.trim().toLowerCase() === 'delete' && b.closest('[role="dialog"]')) { confirm = b; break; }
        }
      }

      if (!confirm) {
        dismiss();
        await sleep(gauss(300, 600));
        skipped++;
        return 'no_confirm';
      }

      click(confirm);
      await sleep(gauss(400, 900));

      deleted++;
      session++;
      return 'deleted';
    },

    async run() {
      this.running = true;
      $('#xs-start').style.display = 'none';
      $('#xs-stop').style.display = 'block';
      log('Starting...');
      setStatus('Scrubbing...');

      let sinceBreak = 0;
      let breakAt = Math.floor(gauss(spd.breakEvery[0], spd.breakEvery[1]));
      let scrollFails = 0;

      while (this.running) {
        if (session >= spd.limit) {
          log(`Session limit (${spd.limit}). Take a break!`);
          setStatus('Session limit reached');
          break;
        }

        // Periodic break
        if (sinceBreak >= breakAt) {
          const bLen = gauss(spd.breakLen[0], spd.breakLen[1]);
          log(`Break for ${(bLen/1000).toFixed(0)}s...`);
          setStatus(`Break (${(bLen/1000).toFixed(0)}s)...`);
          sinceBreak = 0;
          breakAt = Math.floor(gauss(spd.breakEvery[0], spd.breakEvery[1]));
          await sleep(bLen);
          if (!this.running) break;
          setStatus('Scrubbing...');
        }

        const result = await this.deleteOne();

        if (result === 'deleted') {
          log(`✓ Deleted post #${deleted}`);
          sinceBreak++;
          scrollFails = 0;
        } else if (result === 'skipped') {
          log('⊘ Skipped (no delete option)');
          scrollFails = 0;
        } else if (result === 'no_confirm') {
          log('⊘ Skipped (no confirm dialog)');
        } else if (result === 'scrolled') {
          scrollFails++;
          if (scrollFails > 5) {
            log('No more posts found. Done!');
            setStatus('Done! 🎉');
            break;
          }
          log('Scrolling for more...');
        }

        updateStats();

        if (this.running) {
          await sleep(gauss(spd.min, spd.max));
        }
      }

      this.running = false;
      $('#xs-start').textContent = session > 0 ? 'Resume' : 'Start Scrubbing';
      $('#xs-start').style.display = 'block';
      $('#xs-stop').style.display = 'none';
      log(`Stopped. ${deleted} deleted, ${skipped} skipped.`);
    },

    stop() {
      this.running = false;
      setStatus('Stopped');
      log('Stopped by user.');
    }
  };

  // Button handlers
  $('#xs-start').addEventListener('click', () => scrubber.run());
  $('#xs-stop').addEventListener('click', () => scrubber.stop());
  $('#xs-close').addEventListener('click', () => {
    scrubber.stop();
    overlay.remove();
    window.__xcomScrubber = null;
  });

  window.__xcomScrubber = scrubber;
  log('Ready. Navigate to a community and hit Start.');
})();

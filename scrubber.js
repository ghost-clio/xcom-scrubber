// XCom Scrubber — Content Script
// Runs on x.com/i/communities/* pages
// Zero external requests. DOM interaction only.

(() => {
  'use strict';

  // State
  let running = false;
  let paused = false;
  let deleted = 0;
  let failed = 0;
  let session = 0;
  let deletesSinceBreak = 0;
  let speed = {
    minDelay: 3000, maxDelay: 8000,
    breakEvery: [15, 30], breakDuration: [20000, 60000],
    sessionLimit: 250
  };

  // === HUMAN-LIKE RANDOMIZATION ===

  // Gaussian-ish random (central tendency, not uniform)
  function gaussRandom(min, max) {
    const u1 = Math.random();
    const u2 = Math.random();
    const norm = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const scaled = (norm + 3) / 6; // map to ~0-1
    const clamped = Math.max(0, Math.min(1, scaled));
    return min + clamped * (max - min);
  }

  function randomDelay() {
    return gaussRandom(speed.minDelay, speed.maxDelay);
  }

  function randomBreakInterval() {
    return Math.floor(gaussRandom(speed.breakEvery[0], speed.breakEvery[1]));
  }

  function randomBreakDuration() {
    return gaussRandom(speed.breakDuration[0], speed.breakDuration[1]);
  }

  // Simulate natural mouse movement to an element
  function humanClick(element) {
    const rect = element.getBoundingClientRect();
    // Click slightly off-center each time
    const offsetX = gaussRandom(-3, 3);
    const offsetY = gaussRandom(-3, 3);
    const x = rect.left + rect.width / 2 + offsetX;
    const y = rect.top + rect.height / 2 + offsetY;

    // Dispatch events in order a real click produces
    const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    for (const type of events) {
      const evt = new MouseEvent(type, {
        bubbles: true, cancelable: true, view: window,
        clientX: x, clientY: y, button: 0
      });
      element.dispatchEvent(evt);
    }
  }

  // Wait with a promise
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // === DOM INTERACTION ===

  // Find the three-dot menu on a post (community posts have admin actions)
  function findPostMenuButtons() {
    // X uses data-testid="caret" for the three-dot menu on tweets
    return document.querySelectorAll('[data-testid="caret"]');
  }

  // Find the "Delete" option in an open menu
  function findDeleteOption() {
    // Look for menu items containing "Delete" text
    const menuItems = document.querySelectorAll('[role="menuitem"]');
    for (const item of menuItems) {
      const text = item.textContent?.toLowerCase() || '';
      if (text.includes('delete') || text.includes('remove')) {
        return item;
      }
    }
    return null;
  }

  // Find confirmation button in delete dialog
  function findConfirmDelete() {
    // X shows a confirmation dialog with a red "Delete" button
    const buttons = document.querySelectorAll('[data-testid="confirmationSheetConfirm"]');
    if (buttons.length > 0) return buttons[0];
    
    // Fallback: look for buttons with "Delete" text in dialogs
    const allButtons = document.querySelectorAll('[role="button"]');
    for (const btn of allButtons) {
      const text = btn.textContent?.toLowerCase() || '';
      if (text === 'delete' && btn.closest('[role="dialog"]')) {
        return btn;
      }
    }
    return null;
  }

  // Close any open menu/dialog
  function dismissMenu() {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', code: 'Escape', bubbles: true
    }));
  }

  // Smooth scroll to next posts
  function humanScroll() {
    const scrollAmount = gaussRandom(200, 500);
    window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
  }

  // === MAIN DELETE LOOP ===

  async function deleteOnePost() {
    const menus = findPostMenuButtons();
    if (menus.length === 0) {
      // Need to scroll to load more posts
      humanScroll();
      await sleep(gaussRandom(1500, 3000));
      return 'scrolled';
    }

    // Pick the first visible post's menu
    const menuBtn = menus[0];

    // Scroll the post into view naturally
    menuBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(gaussRandom(400, 800));

    // Click the three-dot menu
    humanClick(menuBtn);
    await sleep(gaussRandom(500, 1200));

    // Look for Delete option
    const deleteOpt = findDeleteOption();
    if (!deleteOpt) {
      // No delete option — we're not admin of this post, dismiss and skip
      dismissMenu();
      await sleep(gaussRandom(300, 600));
      failed++;
      return 'no_delete_option';
    }

    // Click Delete
    humanClick(deleteOpt);
    await sleep(gaussRandom(600, 1500));

    // Confirm deletion
    const confirmBtn = findConfirmDelete();
    if (!confirmBtn) {
      // Confirmation didn't appear, dismiss
      dismissMenu();
      await sleep(gaussRandom(300, 600));
      failed++;
      return 'no_confirm';
    }

    // Click confirm
    humanClick(confirmBtn);
    await sleep(gaussRandom(300, 800));

    deleted++;
    session++;
    deletesSinceBreak++;
    return 'deleted';
  }

  async function mainLoop() {
    let breakAt = randomBreakInterval();
    let scrollFails = 0;

    while (running) {
      // Wait if paused
      while (paused && running) {
        await sleep(500);
      }
      if (!running) break;

      // Session limit check
      if (session >= speed.sessionLimit) {
        console.log(`[XCom Scrubber] Session limit reached (${speed.sessionLimit}). Stopping for safety.`);
        running = false;
        sendStatus();
        break;
      }

      // Take a break periodically
      if (deletesSinceBreak >= breakAt) {
        const breakTime = randomBreakDuration();
        console.log(`[XCom Scrubber] Taking a ${(breakTime / 1000).toFixed(0)}s break after ${deletesSinceBreak} deletes...`);
        deletesSinceBreak = 0;
        breakAt = randomBreakInterval();
        await sleep(breakTime);
        if (!running) break;
      }

      // Delete one post
      const result = await deleteOnePost();

      if (result === 'scrolled') {
        scrollFails++;
        if (scrollFails > 5) {
          console.log('[XCom Scrubber] No more posts found. Done!');
          running = false;
          sendStatus();
          break;
        }
      } else {
        scrollFails = 0;
      }

      // Send status update
      sendStatus();

      // Human-like delay before next action
      if (running) {
        const delay = randomDelay();
        await sleep(delay);
      }
    }

    console.log(`[XCom Scrubber] Stopped. Deleted: ${deleted}, Failed: ${failed}, Session: ${session}`);
  }

  // === COMMUNICATION ===

  function sendStatus() {
    try {
      chrome.runtime.sendMessage({
        type: 'STATUS',
        deleted, failed, session, running,
        sessionLimit: speed.sessionLimit
      });
    } catch (e) {
      // Popup might be closed, that's fine
    }
  }

  // Listen for commands from popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'START':
        if (!running) {
          speed = msg.profile || speed;
          running = true;
          paused = false;
          session = 0;
          deletesSinceBreak = 0;
          mainLoop();
        }
        break;
      case 'PAUSE':
        paused = true;
        break;
      case 'RESUME':
        paused = false;
        break;
      case 'STOP':
        running = false;
        paused = false;
        break;
      case 'SET_SPEED':
        speed = msg.profile || speed;
        break;
      case 'GET_STATUS':
        sendStatus();
        break;
    }
  });

  console.log('[XCom Scrubber] Content script loaded. Ready to scrub.');
})();

'use strict';

(function () {
  const DATA_FILE = 'story/chat_data.md';

  // ── DOM ──────────────────────────────────────────────────────────────────
  const toggle = document.createElement('button');
  toggle.id    = 'chat-toggle';
  toggle.title = 'Open chat';
  toggle.textContent = '💬';

  const panel = document.createElement('div');
  panel.id = 'chat-panel';
  panel.innerHTML = `
    <div id="chat-header">Chat</div>
    <div id="chat-messages"><span class="chat-empty">Loading…</span></div>
    <div id="chat-footer">
      If you actually want to share your thoughts,
      <a href="mailto:ludox73@gmail.com,jsoutoc@proton.me">write us</a> an email.
    </div>`;

  document.body.appendChild(panel);
  document.body.appendChild(toggle);

  const msgList = panel.querySelector('#chat-messages');
  let open = false;
  let loaded = false;

  // ── Zoom compensation ────────────────────────────────────────────────────
  const baseDPR = window.devicePixelRatio;
  function updateZoom() {
    const scale = baseDPR / window.devicePixelRatio;
    document.documentElement.style.setProperty('--chat-zoom', scale);
  }
  updateZoom();
  window.addEventListener('resize', updateZoom);

  // ── Toggle ───────────────────────────────────────────────────────────────
  toggle.addEventListener('click', () => {
    open = !open;
    panel.classList.toggle('chat-open', open);
    if (open && !loaded) loadAndRender();
  });

  // ── Load & render ─────────────────────────────────────────────────────────
  async function loadAndRender() {
    try {
      const r    = await fetch(DATA_FILE);
      const text = await r.text();
      const chats = text.split(/\n\s*\n/).filter(c => c.trim());
      const chat  = chats[Math.floor(Math.random() * chats.length)];
      const msgs  = chat.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .map(l => {
          const colon = l.indexOf(':');
          if (colon < 1) return null;
          return { name: l.slice(0, colon).trim(), text: l.slice(colon + 1).trim() };
        })
        .filter(Boolean);
      loaded = true;
      if (!msgs.length) {
        msgList.innerHTML = '<span class="chat-empty">No messages yet.</span>';
        return;
      }
      msgList.innerHTML = msgs.map(m => `
        <div class="chat-msg">
          <span class="chat-msg-name">${esc(m.name)}</span>
          <span class="chat-msg-text">${fmt(m.text)}</span>
        </div>`).join('');
      msgList.scrollTop = 0;
    } catch {
      msgList.innerHTML = '<span class="chat-empty">Could not load messages.</span>';
    }
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function fmt(s) {
    return esc(s).replace(/~~(.+?)~~/g, '<s>$1</s>');
  }
})();

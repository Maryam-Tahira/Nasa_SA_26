/* Astro - AI space guide. Talks to POST /api/chat (the API key lives on the server). */
(function () {
  'use strict';

  var MAX_SENT = 10;                 // turns sent to the server each time
  var history = [];                  // [{role:'user'|'assistant', content:'...'}]
  var busy = false;

  var STARTERS = [
    'Why is Venus hotter than Mercury?',
    'How do rockets work?',
    'What is a black hole?'
  ];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;     // textContent only: replies are never parsed as HTML
    return e;
  }

  // ---- build the UI ----
  // Astro the alien: a cute floating guide with a "talk to me" bubble above its head
  var wrap = el('div', 'aqc-wrap');
  var bubble = el('button', 'aqc-bubble', 'Hi! Talk to me 💬');
  bubble.type = 'button';
  bubble.setAttribute('aria-label', 'Open chat with Astro');
  var fab = el('button', 'aqc-fab');
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Ask Astro, the AI space guide');
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-controls', 'aqc-panel');
  fab.innerHTML = '<svg class="aqc-alien" viewBox="0 0 120 130" width="78" height="84" aria-hidden="true">' +
    '<defs><radialGradient id="aqcG" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#b9ff8a"/><stop offset="1" stop-color="#3ccf5e"/></radialGradient></defs>' +
    '<ellipse cx="60" cy="124" rx="30" ry="5" fill="rgba(0,0,0,0.35)"/>' +
    '<line x1="60" y1="28" x2="60" y2="8" stroke="#3ccf5e" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="7" r="6" fill="#ffd93b" class="aqc-ant"/>' +
    '<ellipse cx="60" cy="92" rx="22" ry="20" fill="url(#aqcG)"/>' +
    '<ellipse cx="36" cy="96" rx="8" ry="5" fill="#3ccf5e" transform="rotate(-25 36 96)"/><ellipse cx="84" cy="96" rx="8" ry="5" fill="#3ccf5e" transform="rotate(25 84 96)"/>' +
    '<path d="M22 58 C22 28 98 28 98 58 C98 82 80 96 60 96 C40 96 22 82 22 58Z" fill="url(#aqcG)"/>' +
    '<ellipse class="aqc-eye" cx="45" cy="60" rx="10" ry="13" fill="#0b1020"/><ellipse class="aqc-eye" cx="75" cy="60" rx="10" ry="13" fill="#0b1020"/>' +
    '<circle cx="48" cy="55" r="3.5" fill="#fff"/><circle cx="78" cy="55" r="3.5" fill="#fff"/>' +
    '<path d="M50 80 Q60 88 70 80" stroke="#0b1020" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<circle cx="36" cy="74" r="4" fill="#ff8fab" opacity="0.7"/><circle cx="84" cy="74" r="4" fill="#ff8fab" opacity="0.7"/>' +
    '<path d="M44 100 Q38 112 48 118" stroke="#3ccf5e" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M76 100 Q82 112 72 118" stroke="#3ccf5e" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '</svg>';
  wrap.appendChild(bubble);
  wrap.appendChild(fab);

  var panel = el('section', 'aqc-panel');
  panel.id = 'aqc-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Chat with Astro, the space guide');

  var head = el('div', 'aqc-head');
  var titleBox = el('div');
  titleBox.appendChild(el('div', 'aqc-title', 'Astro · AI space guide'));
  titleBox.appendChild(el('div', 'aqc-sub', 'Ask me anything about space. I can make mistakes, so check big facts.'));
  var closeBtn = el('button', 'aqc-close', '✕');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close chat');
  head.appendChild(titleBox);
  head.appendChild(closeBtn);

  var log = el('div', 'aqc-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');

  var chips = el('div', 'aqc-chips');
  STARTERS.forEach(function (q) {
    var c = el('button', 'aqc-chip', q);
    c.type = 'button';
    c.addEventListener('click', function () { send(q); });
    chips.appendChild(c);
  });

  var form = el('form', 'aqc-form');
  var input = el('input', 'aqc-input');
  input.type = 'text';
  input.maxLength = 500;
  input.placeholder = 'Ask about planets, rockets, stars…';
  input.setAttribute('aria-label', 'Your question');
  input.autocomplete = 'off';
  var sendBtn = el('button', 'aqc-send', 'Send');
  sendBtn.type = 'submit';
  form.appendChild(input);
  form.appendChild(sendBtn);

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(chips);
  panel.appendChild(form);
  document.body.appendChild(panel);
  document.body.appendChild(wrap);

  var greeted = false;

  function bubble(kind, text) {
    var b = el('div', 'aqc-msg ' + kind, text);
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function openChat() {
    panel.classList.add('open');
    wrap.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    if (!greeted) {
      greeted = true;
      var name = window.AQ && window.AQ.auth && window.AQ.name ? ' ' + window.AQ.name : '';
      bubble('bot', 'Hi' + name + '! I\'m Astro. Ask me about planets, rockets, black holes, or how to use AstroQuest.');
    }
    input.focus();
  }

  function closeChat() {
    panel.classList.remove('open');
    wrap.classList.remove('open');
    fab.setAttribute('aria-expanded', 'false');
    fab.focus();
  }

  fab.addEventListener('click', function () { panel.classList.contains('open') ? closeChat() : openChat(); });
  bubble.addEventListener('click', openChat);
  closeBtn.addEventListener('click', closeChat);
  panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeChat(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    send(input.value);
  });

  function setBusy(v) {
    busy = v;
    sendBtn.disabled = v;
    input.disabled = v;
  }

  async function send(raw) {
    var text = (raw || '').trim();
    if (!text || busy) return;

    chips.style.display = 'none';
    input.value = '';
    bubble('user', text);
    history.push({ role: 'user', content: text });

    setBusy(true);
    var wait = bubble('bot wait', 'Astro is thinking…');

    try {
      var res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-MAX_SENT) })
      });

      var data = null;
      try { data = await res.json(); } catch (_) { /* not JSON */ }

      if (res.ok && data && data.reply) {
        wait.className = 'aqc-msg bot';
        wait.textContent = data.reply;
        history.push({ role: 'assistant', content: data.reply });
      } else {
        history.pop();   // keep the history clean so the next try works
        wait.className = 'aqc-msg bot err';
        wait.textContent = res.status === 429
          ? 'That was a lot of questions. Wait a minute and ask again.'
          : (data && data.error) || 'Astro could not answer right now. Please try again.';
      }
    } catch (_) {
      history.pop();
      wait.className = 'aqc-msg bot err';
      wait.textContent = 'Astro lost the signal. Check your connection and try again.';
    } finally {
      setBusy(false);
      log.scrollTop = log.scrollHeight;
      if (panel.classList.contains('open')) input.focus();
    }
  }
})();

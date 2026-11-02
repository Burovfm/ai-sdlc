/* =========================================================
   AI-native SDLC — навигатор погружения
   Рендер-движок, прогресс, чекпоинты, квизы, поиск
   ========================================================= */
(function () {
  'use strict';

  var LS = 'ainsdlc.v1';
  var CHAPTERS = window.CHAPTERS || [];
  var GLOSSARY = window.GLOSSARY || [];
  var EXAM = window.EXAM || [];

  var state = loadState();
  var runtime = {};          // chapterId -> { quizIds:[], checkId, checkTotal }
  var currentChapter = null;
  var searchEntries = [];
  var pendingScroll = null;
  var pendingAnchor = null;

  /* ---------------- utils ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, ''); }

  /* Детерминированное перемешивание вариантов: позиция правильного ответа
     не должна быть предсказуемой («всегда второй вариант»). */
  function permFor(seed, n) {
    var perm = [], i, k, r, t;
    for (i = 0; i < n; i++) perm.push(i);
    var h = 2166136261;
    for (i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    for (k = n - 1; k > 0; k--) {
      h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
      r = h % (k + 1);
      t = perm[k]; perm[k] = perm[r]; perm[r] = t;
    }
    return perm;
  }

  function loadState() {
    var base = { v: 1, chapterDone: {}, quiz: {}, check: {}, assess: {}, exam: {}, settings: {} };
    try {
      var raw = localStorage.getItem(LS);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p === 'object') {
          Object.keys(base).forEach(function (k) { if (p[k] == null) p[k] = base[k]; });
          return p;
        }
      }
    } catch (e) { /* ignore */ }
    return base;
  }
  function saveState() {
    try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function toast(msg, kind) {
    var wrap = $('#toastWrap');
    if (!wrap) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || 'ok');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(function () { el.remove(); }, 320);
    }, 3200);
  }

  function confetti() {
    var wrap = document.createElement('div');
    wrap.className = 'confetti';
    var colors = ['#e4002b', '#ff8a5c', '#22d3ee', '#34d399', '#fbbf24', '#a78bfa'];
    for (var i = 0; i < 46; i++) {
      var p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
      p.style.setProperty('--rot', (Math.random() * 900 - 450) + 'deg');
      p.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      p.style.animationDelay = (Math.random() * .25) + 's';
      p.style.width = (5 + Math.random() * 5) + 'px';
      p.style.height = (8 + Math.random() * 8) + 'px';
      p.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap);
    setTimeout(function () { wrap.remove(); }, 3600);
  }

  /* ---------------- inline markdown ---------------- */
  function mdInline(str) {
    if (str == null) return '';
    var s = esc(str);
    s = s.replace(/`([^`]+)`/g, function (_, c) { return '<code>' + c + '</code>'; });
    s = s.replace(/\{\{([^}]+)\}\}/g, '<span class="accent">$1</span>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) {
      return '<a href="' + u + '"' + (u.charAt(0) === '#' ? '' : ' target="_blank" rel="noopener"') + '>' + t + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(«"'])\*([^*\n]+)\*(?=[\s.,;:!?)»"']|$)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  /* ---------------- block renderers ---------------- */
  function renderBlocks(blocks, chId) {
    return (blocks || []).map(function (b, i) { return renderBlock(b, chId, i); }).join('');
  }

  function renderBlock(b, chId, idx) {
    if (!b) return '';
    var inner;
    switch (b.t) {
      case 'h2':
        return '<div class="block" data-b="' + idx + '"><h2 id="h-' + chId + '-' + idx + '">' + mdInline(b.x) + '</h2></div>';
      case 'h3':
        return '<div class="block" data-b="' + idx + '"><h3>' + mdInline(b.x) + '</h3></div>';
      case 'h5':
        return '<h5>' + mdInline(b.x) + '</h5>';
      case 'p':
        return '<div class="block" data-b="' + idx + '"><p>' + mdInline(b.x) + '</p></div>';
      case 'ul':
        return '<div class="block" data-b="' + idx + '"><ul class="' + (b.cls || '') + '">' +
          b.items.map(function (it) { return '<li>' + mdInline(typeof it === 'string' ? it : it.x) + '</li>'; }).join('') + '</ul></div>';
      case 'ol':
        return '<div class="block" data-b="' + idx + '"><ol>' +
          b.items.map(function (it) { return '<li>' + mdInline(it) + '</li>'; }).join('') + '</ol></div>';
      case 'table':
        return '<div class="block" data-b="' + idx + '"><div class="table-wrap"><table class="' + (b.cls || '') + '">' +
          (b.head ? '<thead><tr>' + b.head.map(function (h) { return '<th>' + mdInline(h) + '</th>'; }).join('') + '</tr></thead>' : '') +
          '<tbody>' + b.rows.map(function (r) {
            return '<tr>' + r.map(function (c) { return '<td>' + mdInline(c) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table></div></div>';
      case 'code':
        return '<div class="block" data-b="' + idx + '"><div class="code-wrap"><button class="copy-btn" type="button">копировать</button>' +
          (b.label ? '<span class="code-label">' + esc(b.label) + '</span>' : '') +
          '<pre><code>' + esc(b.x) + '</code></pre></div></div>';
      case 'note':
        var icons = { info: 'ℹ️', tip: '✅', warn: '⚠️', danger: '⛔', quote: '💬' };
        return '<div class="block" data-b="' + idx + '"><div class="note ' + (b.kind || 'info') + '"><div class="note-ico">' +
          (icons[b.kind] || 'ℹ️') + '</div><div class="note-body">' +
          (b.title ? '<div class="note-title">' + mdInline(b.title) + '</div>' : '') +
          '<p>' + mdInline(b.x) + '</p></div></div></div>';
      case 'cards':
        return '<div class="block" data-b="' + idx + '"><div class="cards">' + b.items.map(function (c) {
          return '<div class="card">' + (c.icon ? '<div class="card-ico">' + c.icon + '</div>' : '') +
            '<h4>' + mdInline(c.title) + '</h4>' + (c.text ? '<p>' + mdInline(c.text) + '</p>' : '') +
            (c.tag ? '<span class="tag">' + mdInline(c.tag) + '</span>' : '') + '</div>';
        }).join('') + '</div></div>';
      case 'kpi':
        return '<div class="block" data-b="' + idx + '"><div class="kpis">' + b.items.map(function (k) {
          return '<div class="kpi ' + (k.color || '') + '"><b>' + mdInline(k.value) + '</b><span>' + mdInline(k.label) + '</span></div>';
        }).join('') + '</div></div>';
      case 'steps':
        return '<div class="block" data-b="' + idx + '"><div class="steps">' + b.items.map(function (s) {
          return '<div class="step"><div><div class="step-title">' + mdInline(s.title) + '</div>' +
            (s.text ? '<p>' + mdInline(s.text) + '</p>' : '') +
            (s.meta ? '<div class="step-meta">' + mdInline(s.meta) + '</div>' : '') + '</div></div>';
        }).join('') + '</div></div>';
      case 'compare':
        return '<div class="block" data-b="' + idx + '"><div class="compare">' +
          '<div class="compare-col before"><div class="compare-head"><span class="b">✕</span>' + mdInline(b.left.title) + '</div><ul>' +
          b.left.items.map(function (x) { return '<li>' + mdInline(x) + '</li>'; }).join('') + '</ul></div>' +
          '<div class="compare-col after"><div class="compare-head"><span class="b">→</span>' + mdInline(b.right.title) + '</div><ul>' +
          b.right.items.map(function (x) { return '<li>' + mdInline(x) + '</li>'; }).join('') + '</ul></div></div></div>';
      case 'tabs':
        var uid = 'tabs-' + chId + '-' + idx;
        return '<div class="block" data-b="' + idx + '"><div class="tabs" id="' + uid + '">' +
          '<div class="tabs-nav">' + b.items.map(function (t, i) {
            return '<button class="tab-btn' + (i === 0 ? ' active' : '') + '" data-tab="' + i + '" type="button">' + esc(t.label) + '</button>';
          }).join('') + '</div>' +
          b.items.map(function (t, i) {
            return '<div class="tab-panel' + (i === 0 ? ' active' : '') + '" data-panel="' + i + '">' + renderBlocks(t.blocks, chId) + '</div>';
          }).join('') + '</div></div>';
      case 'acc':
        return '<div class="block" data-b="' + idx + '"><div class="acc">' + b.items.map(function (a, i) {
          return '<div class="acc-item' + (a.open ? ' open' : '') + '"><button class="acc-head" type="button">' +
            '<span>' + mdInline(a.q) + '</span><svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></button>' +
            '<div class="acc-body">' + renderBlocks(a.blocks, chId) + '</div></div>';
        }).join('') + '</div></div>';
      case 'timeline':
        return '<div class="block" data-b="' + idx + '"><div class="timeline">' + b.items.map(function (t) {
          return '<div class="tl-item"><div class="tl-when">' + mdInline(t.when) + '</div><div class="tl-title">' + mdInline(t.title) + '</div>' +
            (t.text ? '<p>' + mdInline(t.text) + '</p>' : '') + '</div>';
        }).join('') + '</div></div>';
      case 'levels':
        return '<div class="block" data-b="' + idx + '"><div class="levels">' + b.items.map(function (lv, i) {
          return '<div class="level' + (i === 0 ? ' open' : '') + '" data-level="' + i + '">' +
            '<div class="level-top"><div class="level-badge">' + esc(lv.badge || ('L' + (i + 1))) + '</div>' +
            '<div><div class="level-title">' + mdInline(lv.title) + '</div><div class="level-sub">' + mdInline(lv.sub || '') + '</div></div></div>' +
            '<div class="level-body">' + renderBlocks(lv.blocks, chId) + '</div></div>';
        }).join('') + '</div></div>';
      case 'flashcards':
        return '<div class="block" data-b="' + idx + '"><div class="flash-wrap">' + b.items.map(function (f) {
          return '<div class="flash"><div class="flash-inner"><div class="flash-face"><span class="hint">вопрос</span><span class="q">' + mdInline(f.q) + '</span></div>' +
            '<div class="flash-face flash-back"><span class="hint">ответ</span><span class="a">' + mdInline(f.a) + '</span></div></div></div>';
        }).join('') + '</div></div>';
      case 'selfassess':
        return '<div class="block" data-b="' + idx + '"><div class="assess" data-assess="' + (b.id || chId) + '">' +
          '<div class="checklist-head"><h3>' + mdInline(b.title || 'Самопроверка компетенций') + '</h3></div>' +
          '<p class="checklist-sub">' + mdInline(b.sub || 'Оцени себя по шкале: 0 — не умею, 1 — знаю теорию, 2 — делал с поддержкой, 3 — делаю сам и учу других.') + '</p>' +
          '<div class="assess-legend"><span>0 — не умею</span><span>3 — делаю сам и учу других</span></div>' +
          b.items.map(function (it, i) {
            var nm = typeof it === 'string' ? it : it.name;
            return '<div class="assess-row"><div class="assess-name">' + mdInline(nm) + '</div><div class="seg" data-comp="' + i + '" role="group">' +
              [0, 1, 2, 3].map(function (v) { return '<button type="button" data-v="' + v + '">' + v + '</button>'; }).join('') + '</div></div>';
          }).join('') +
          '<div class="assess-result"></div>' +
          '<div class="btn-row" style="margin-top:14px"><button class="btn btn-primary" type="button" data-assess-go>Показать результат</button>' +
          '<button class="btn btn-ghost" type="button" data-assess-reset>Сбросить</button></div></div></div>';
      case 'checklistsMap':
        return '<div class="block" data-b="' + idx + '"><div id="cpMap"></div></div>';
      case 'glossary':
        return '<div class="block" data-b="' + idx + '"><div class="glossary-tools"><input type="search" id="glossInput" placeholder="Фильтр: контракт, гейт, SDD, context…"></div><div class="gloss-list" id="glossList"></div></div>';
      case 'lkCatalog':
        return '<div class="block" data-b="' + idx + '"><div class="lk-cat">' +
          '<div class="lk-cat-tools"><input type="search" id="lkFilter" placeholder="Фильтр: номера, договор, SMS, статус, API…">' +
          '<span class="lk-cat-count" id="lkCount"></span></div>' +
          '<div class="lk-cat-list" id="lkList"></div></div></div>';
      case 'exam':
        return '<div class="block" data-b="' + idx + '"><div id="examMount"></div></div>';
      case 'hero':
        return '<div class="block"><div class="hero"><div class="hero-inner"><div>' +
          (b.eyebrow ? '<div class="eyebrow"><span class="dot"></span>' + mdInline(b.eyebrow) + '</div>' : '') +
          '<h1>' + mdInline(b.title) + '</h1>' +
          '<p class="lead">' + mdInline(b.lead) + '</p>' +
          '<div class="hero-actions">' + (b.actions || []).map(function (a) {
            return '<button class="btn ' + (a.primary ? 'btn-primary' : 'btn-ghost') + '" type="button" data-goto="' + a.goto + '">' + esc(a.label) + ' →</button>';
          }).join('') + '</div></div>' +
          '<div class="hero-stats">' + (b.stats || []).map(function (s) {
            return '<div class="stat-card"><b>' + mdInline(s.v) + '</b><span>' + mdInline(s.label) + '</span></div>';
          }).join('') + '</div></div></div></div>';
      case 'divider':
        return '<div class="divider"></div>';
      default:
        inner = b.x ? mdInline(b.x) : '';
        return inner ? '<div class="block"><p>' + inner + '</p></div>' : '';
    }
  }

  /* ---------------- chapter render ---------------- */
  function chapterIndex(id) {
    for (var i = 0; i < CHAPTERS.length; i++) if (CHAPTERS[i].id === id) return i;
    return -1;
  }

  function renderChapter(ch) {
    currentChapter = ch;
    runtime[ch.id] = { quizIds: [], checkIds: [], ask: 0 };
    var idx = chapterIndex(ch.id);

    var html = '';
    if (!ch.hideHead) {
      html += '<div class="chapter-head">';
      html += '<div class="eyebrow"><span class="dot"></span>' + esc(ch.part || 'Раздел') + ' · ' + (idx + 1) + ' / ' + CHAPTERS.length + '</div>';
      html += '<h1>' + mdInline(ch.title) + '</h1>';
      if (ch.lede) html += '<p class="chapter-lede">' + mdInline(ch.lede) + '</p>';
      html += '<div class="chapter-meta">';
      if (ch.minutes) html += '<span class="pill">⏱ <b>' + ch.minutes + '</b> мин</span>';
      (ch.tags || []).forEach(function (t) { html += '<span class="pill">' + esc(t) + '</span>'; });
      if (ch.checkpoint) html += '<span class="pill red">🚩 чекпоинт</span>';
      html += '</div></div>';
    }

    html += '<div id="blocks">' + renderBlocks(ch.blocks, ch.id) + '</div>';

    // quiz (all questions, one flow)
    if (ch.quiz && ch.quiz.length) {
      ch.quiz.forEach(function (q, i) {
        var qid = ch.id + '-q' + i;
        runtime[ch.id].quizIds.push(qid);
      });
      html += '<div class="block"><div class="quiz" id="quiz-' + ch.id + '"></div></div>';
    }

    // checklist
    if (ch.checklist) {
      var cid = ch.id + '-check';
      runtime[ch.id].checkId = cid;
      runtime[ch.id].checkTotal = ch.checklist.items.length;
      html += '<div class="block"><div class="checklist" data-check="' + cid + '">' +
        '<div class="checklist-head"><h3>' + mdInline(ch.checklist.title || 'Чек-лист: проверь себя') + '</h3></div>' +
        (ch.checklist.sub ? '<p class="checklist-sub">' + mdInline(ch.checklist.sub) + '</p>' : '') +
        ch.checklist.items.map(function (it, i) {
          return '<label class="check-row"><input type="checkbox" data-ci="' + i + '"><span>' + mdInline(it) + '</span></label>';
        }).join('') +
        '<div class="checklist-foot"><span class="checklist-count">0 / ' + ch.checklist.items.length + '</span>' +
        '<span class="cp-done" style="display:none">✓ всё отмечено</span></div></div></div>';
    }

    // checkpoint
    if (ch.checkpoint) {
      html += '<div class="block"><div class="checkpoint" id="cp-' + ch.id + '">' +
        '<div class="cp-ico">🚩</div><div class="cp-body"><div class="cp-title">' + mdInline(ch.checkpoint.title) + '</div>' +
        '<div class="cp-text">' + mdInline(ch.checkpoint.text || '') + '</div>' +
        '<div class="cp-status">Статус: <b data-cp-status>не пройден</b></div></div></div></div>';
    }

    // prev/next
    var prev = CHAPTERS[idx - 1], next = CHAPTERS[idx + 1];
    html += '<div class="chapter-nav">';
    html += prev ? '<a class="prev" href="#/' + prev.id + '"><div class="dir">← назад</div><div class="t">' + esc(prev.title) + '</div></a>' : '<span></span>';
    html += next ? '<a class="next" href="#/' + next.id + '"><div class="dir">далее →</div><div class="t">' + esc(next.title) + '</div></a>' : '<span></span>';
    html += '</div>';

    var mount = $('#chapterMount');
    mount.innerHTML = html;

    initTabs(mount);
    initAccordions(mount);
    initCopy(mount);
    initFlashcards(mount);
    initLevels(mount);
    initQuiz(mount, ch);
    initChecklist(mount, ch);
    initAssess(mount, ch);
    initExam(mount, ch);
    initGlossary(mount);
    initLkCatalog(mount);
    initCheckpointsMap(mount);

    evaluateChapter(ch);
    updateProgressUI();
    updateNavActive();
    window.scrollTo({ top: 0, behavior: 'auto' });

    if (pendingScroll != null) {
      var target = mount.querySelector('[data-b="' + pendingScroll + '"]');
      pendingScroll = null;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.style.transition = 'box-shadow .4s';
        target.style.boxShadow = '0 0 0 2px var(--red)';
        setTimeout(function () { target.style.boxShadow = 'none'; }, 1600);
      }
    } else if (pendingAnchor) {
      var anchorEl = document.getElementById(pendingAnchor);
      pendingAnchor = null;
      if (anchorEl) {
        anchorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        anchorEl.style.transition = 'box-shadow .4s';
        anchorEl.style.boxShadow = '0 0 0 2px var(--red)';
        setTimeout(function () { anchorEl.style.boxShadow = 'none'; }, 1600);
      }
    }
  }

  /* ---------------- init helpers ---------------- */
  function initTabs(root) {
    $$('.tabs', root).forEach(function (tabs) {
      $$('.tab-btn', tabs).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var i = btn.dataset.tab;
          $$('.tab-btn', tabs).forEach(function (b) { b.classList.toggle('active', b === btn); });
          $$('.tab-panel', tabs).forEach(function (p) { p.classList.toggle('active', p.dataset.panel === i); });
        });
      });
    });
  }

  function initAccordions(root) {
    $$('.acc-head', root).forEach(function (head) {
      head.addEventListener('click', function () {
        head.parentElement.classList.toggle('open');
      });
    });
  }

  function initCopy(root) {
    $$('.copy-btn', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pre = btn.parentElement.querySelector('pre');
        var text = pre ? pre.innerText : '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { toast('Скопировано', 'ok'); }, function () { toast('Не удалось скопировать', 'err'); });
        } else {
          var ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); toast('Скопировано', 'ok'); } catch (e) { toast('Не удалось скопировать', 'err'); }
          ta.remove();
        }
      });
    });
  }

  function initFlashcards(root) {
    $$('.flash', root).forEach(function (f) {
      f.addEventListener('click', function () { f.classList.toggle('flipped'); });
    });
  }

  function initLevels(root) {
    $$('.level', root).forEach(function (lv) {
      var top = $('.level-top', lv);
      if (!top) return;
      top.addEventListener('click', function () { lv.classList.toggle('open'); });
      top.setAttribute('role', 'button');
      top.setAttribute('tabindex', '0');
      top.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lv.classList.toggle('open'); }
      });
    });
  }

  function initQuiz(root, ch) {
    if (!ch.quiz || !ch.quiz.length) return;
    var mount = $('#quiz-' + ch.id, root);
    if (!mount) return;
    var qi = 0;

    function renderQ() {
      var q = ch.quiz[qi];
      var qid = ch.id + '-q' + qi;
      var saved = state.quiz[qid] || {};
      var perm = permFor(qid, q.options.length);
      var correctDisplay = perm.indexOf(q.answer);
      mount.innerHTML =
        '<div class="quiz-head"><span class="quiz-tag">Проверь себя</span><span class="quiz-progress">' + (qi + 1) + ' / ' + ch.quiz.length + '</span></div>' +
        '<p class="quiz-q">' + mdInline(q.q) + '</p>' +
        '<div class="quiz-opts">' + perm.map(function (oi, di) {
          return '<button class="quiz-opt" type="button" data-o="' + di + '"><span class="k">' + 'АБВГД'[di] + '</span><span>' + mdInline(q.options[oi]) + '</span></button>';
        }).join('') + '</div>' +
        '<div class="quiz-explain">' + mdInline(q.explain || '') + '</div>' +
        '<div class="quiz-foot"><span class="quiz-score"></span><button class="btn btn-sm btn-ghost" type="button" data-retry hidden>Попробовать снова</button>' +
        '<button class="btn btn-sm btn-primary" type="button" data-next hidden>' + (qi === ch.quiz.length - 1 ? 'Завершить' : 'Дальше') + '</button></div>';

      var opts = $$('.quiz-opt', mount);
      var explain = $('.quiz-explain', mount);
      var nextBtn = $('[data-next]', mount);
      var retryBtn = $('[data-retry]', mount);
      var scoreEl = $('.quiz-score', mount);

      function lock(choiceOk, choice) {
        opts.forEach(function (o, i) {
          o.classList.add('locked');
          if (i === correctDisplay) o.classList.add('correct');
          if (i === choice && !choiceOk) o.classList.add('wrong');
        });
        explain.classList.add('show');
        retryBtn.hidden = choiceOk;
        nextBtn.hidden = !choiceOk;
        scoreEl.textContent = choiceOk ? 'Верно' : 'Неверно — разберись и попробуй снова';
      }

      if (saved.choice != null) {
        var savedDisplay = perm.indexOf(saved.choice);
        if (savedDisplay >= 0) lock(!!saved.ok, savedDisplay);
      }

      opts.forEach(function (o) {
        o.addEventListener('click', function () {
          if (o.classList.contains('locked')) return;
          var choice = +o.dataset.o;
          var ok = choice === correctDisplay;
          var st = state.quiz[qid] || {};
          st.choice = perm[choice];
          st.ok = !!st.ok || ok;
          state.quiz[qid] = st;
          saveState();
          lock(ok, choice);
          evaluateChapter(ch);
          updateProgressUI();
        });
      });

      retryBtn.addEventListener('click', function () {
        delete state.quiz[qid]; saveState(); renderQ(); evaluateChapter(ch); updateProgressUI();
      });
      nextBtn.addEventListener('click', function () {
        if (qi < ch.quiz.length - 1) { qi++; renderQ(); } else { toast('Квиз раздела пройден', 'ok'); }
      });
    }
    renderQ();
  }

  function initChecklist(root, ch) {
    if (!ch.checklist) return;
    var box = $('[data-check]', root);
    if (!box) return;
    var cid = box.dataset.check;
    var inputs = $$('input[data-ci]', box);
    var stored = state.check[cid] || [];
    inputs.forEach(function (inp, i) { inp.checked = !!stored[i]; });

    function refresh() {
      var arr = inputs.map(function (x) { return !!x.checked; });
      state.check[cid] = arr;
      saveState();
      var n = arr.filter(Boolean).length;
      var counter = $('.checklist-count', box);
      if (counter) counter.textContent = n + ' / ' + arr.length;
      var done = $('.cp-done', box);
      if (done) done.style.display = n === arr.length ? 'inline-flex' : 'none';
      evaluateChapter(ch);
      updateProgressUI();
    }
    inputs.forEach(function (inp) { inp.addEventListener('change', refresh); });
    refresh();
  }

  /* ---------------- self assessment ---------------- */
  function initAssess(root, ch) {
    $$('[data-assess]', root).forEach(function (box) {
      var id = box.dataset.assess;
      var comps = $$('.seg', box);
      var saved = state.assess[id] || {};
      comps.forEach(function (seg, i) {
        var v = saved[i];
        if (v != null) {
          $$('button', seg).forEach(function (b) { b.classList.toggle('on', +b.dataset.v === v); });
        }
        $$('button', seg).forEach(function (btn) {
          btn.addEventListener('click', function () {
            saved[i] = +btn.dataset.v;
            state.assess[id] = saved;
            saveState();
            $$('button', seg).forEach(function (b) { b.classList.toggle('on', b === btn); });
          });
        });
      });

      function calc() {
        var total = 0, max = comps.length * 3, threes = 0, twos = 0, zeros = 0, low = [];
        comps.forEach(function (seg, i) {
          var v = saved[i] || 0;
          total += v;
          if (v === 3) threes++; else if (v === 2) twos++; else if (v === 0) zeros++;
          if (v <= 1) low.push({ i: i, v: v });
        });
        var avg = total / max;
        var level, advice;
        if (avg < .25) { level = 'Старт'; advice = 'Начни с раздела «Старт» и «Агент, контекст, харнесс»: без базы практика не зайдёт.'; }
        else if (avg < .45) { level = 'L1 · в процессе'; advice = 'Ты на входе в L1. Закрой чекпоинт L1: системный разбор, раскладка, контракт, контекст для агента.'; }
        else if (avg < .6) { level = 'L1 · почти готов'; advice = 'Добери 2–3 компетенции до «делаю сам» и выполни сквозную задачу L1 целиком.'; }
        else if (avg < .75) { level = 'L2 · в процессе'; advice = 'Ты уверенно делаешь L1. Следующий шаг — вести контракты команды и первый skill для межсистемной работы.'; }
        else if (avg < .88) { level = 'L2 · уверенно'; advice = 'Бери интеграции домена: архитектурные решения между сервисами и автоматические проверки.'; }
        else { level = 'L3 · зона роста'; advice = 'Твоя зона — домен и общие практики: карта сервисов, реестр контрактов, проверки для всех команд.'; }
        return { total: total, max: max, avg: avg, level: level, advice: advice, low: low, threes: threes };
      }

      var result = $('.assess-result', box);
      $('[data-assess-go]', box).addEventListener('click', function () {
        var r = calc();
        state.assess.lastLevel = r.level;
        state.assess.lastAvg = Math.round(r.avg * 100);
        saveState();
        var bars = comps.map(function (seg, i) {
          var v = saved[i] || 0;
          return '<div class="ab"><span>' + esc(seg.closest('.assess-row').querySelector('.assess-name').innerText) + '</span>' +
            '<div class="ab-bar"><div class="ab-fill" style="width:' + (v / 3 * 100) + '%"></div></div><b>' + v + '</b></div>';
        }).join('');
        result.innerHTML = '<div class="ar-level">' + esc(r.level) + ' <small>· ' + r.total + ' / ' + r.max + ' баллов</small></div>' +
          '<p style="margin:6px 0 0;color:var(--text-2);font-size:13.6px">' + mdInline(r.advice) + '</p>' +
          '<div class="assess-bars">' + bars + '</div>';
        result.classList.add('show');
        updateProgressUI();
        toast('Результат самопроверки сохранён', 'ok');
      });
      $('[data-assess-reset]', box).addEventListener('click', function () {
        saved = state.assess[id] = {};
        delete state.assess.lastLevel;
        delete state.assess.lastAvg;
        saveState();
        comps.forEach(function (seg) { $$('button', seg).forEach(function (b) { b.classList.remove('on'); }); });
        result.classList.remove('show');
        result.innerHTML = '';
        updateProgressUI();
        toast('Самопроверка сброшена', 'warn');
      });
    });
  }

  /* ---------------- glossary ---------------- */
  function initGlossary(root) {
    var input = $('#glossInput', root);
    if (!input) return;
    var list = $('#glossList', root);

    function render(q) {
      q = (q || '').trim().toLowerCase();
      var items = GLOSSARY.filter(function (g) {
        if (!q) return true;
        return (g.term + ' ' + (g.en || '') + ' ' + g.def).toLowerCase().indexOf(q) >= 0;
      });
      if (!items.length) {
        list.innerHTML = '<div class="gloss-empty">Ничего не найдено. Попробуй другой термин.</div>';
        return;
      }
      list.innerHTML = items.map(function (g) {
        return '<div class="gloss-item"><div class="gt">' + mdInline(g.term) + (g.en ? '<span class="en">' + esc(g.en) + '</span>' : '') + '</div>' +
          '<div class="gd">' + mdInline(g.def) + '</div>' + (g.src ? '<div class="gsrc">' + mdInline(g.src) + '</div>' : '') + '</div>';
      }).join('');
    }
    input.addEventListener('input', function () { render(input.value); });
    render('');
  }

  /* ---------------- каталог учебного LK-контекста ---------------- */
  function initLkCatalog(root) {
    var list = $('#lkList', root);
    if (!list) return;
    var data = window.LK_CATALOG || [];
    var input = $('#lkFilter', root);
    var count = $('#lkCount', root);
    var labels = { section: 'раздел', page: 'страница', use: 'use cases', memo: 'памятка', empty: 'без текста' };

    function render(q) {
      q = (q || '').trim().toLowerCase();
      var items = data.filter(function (it) {
        if (!q) return true;
        return (it.c + ' ' + it.t + ' ' + (it.d || '') + ' ' + (it.g || '') + ' ' + (labels[it.type] || '')).toLowerCase().indexOf(q) >= 0;
      });
      if (count) count.textContent = items.length + ' из ' + data.length;
      if (!items.length) {
        list.innerHTML = '<div class="gloss-empty">Ничего не найдено. Попробуй: номера, договор, SMS, статус, API, шаблоны.</div>';
        return;
      }
      var groups = {}, order = [];
      items.forEach(function (it) {
        if (!groups[it.g]) { groups[it.g] = []; order.push(it.g); }
        groups[it.g].push(it);
      });
      list.innerHTML = order.map(function (g) {
        var rows = groups[g].map(function (it) {
          var href = encodeURI('training/lk-context/pages/' + it.f);
          return '<a class="lk-item" href="' + href + '" target="_blank" rel="noopener">' +
            '<span class="lk-code">' + esc(it.c) + '</span>' +
            '<span class="lk-name">' + esc(it.t) + '</span>' +
            '<span class="lk-type' + (it.type === 'empty' ? ' empty' : '') + '">' + esc(labels[it.type] || 'страница') + '</span>' +
            '<span class="lk-desc">' + esc(it.d || '') + '</span>' +
            '</a>';
        }).join('');
        return '<div class="lk-group"><div class="lk-sec">' + esc(g) + '</div>' + rows + '</div>';
      }).join('');
    }
    if (input) input.addEventListener('input', function () { render(input.value); });
    render('');
  }

  /* ---------------- checkpoints map ---------------- */
  function initCheckpointsMap(root) {
    var mount = $('#cpMap', root);
    if (!mount) return;
    var done = CHAPTERS.filter(function (c) { return state.chapterDone[c.id]; }).length;
    var html = '<div class="kpis">' +
      '<div class="kpi red"><b>' + done + ' / ' + CHAPTERS.length + '</b><span>чекпоинтов пройдено</span></div>' +
      '<div class="kpi cyan"><b>' + quizCorrect() + ' / ' + quizTotal() + '</b><span>вопросов верно</span></div>' +
      '<div class="kpi green"><b>' + Math.round(done / CHAPTERS.length * 100) + '%</b><span>маршрута</span></div>' +
      '</div>';
    html += '<div class="table-wrap"><table><thead><tr><th>#</th><th>Раздел</th><th>Чекпоинт</th><th>Статус</th><th></th></tr></thead><tbody>';
    CHAPTERS.forEach(function (c, i) {
      var ok = !!state.chapterDone[c.id];
      html += '<tr><td>' + (i + 1) + '</td><td>' + esc(c.title) + '</td><td>' + esc((c.checkpoint && c.checkpoint.title) || '—') + '</td>' +
        '<td>' + (ok ? '<span class="pill green">пройден</span>' : '<span class="pill">не пройден</span>') + '</td>' +
        '<td><a href="#/' + c.id + '" class="btn btn-sm btn-ghost">' + (ok ? 'повторить' : 'пройти') + '</a></td></tr>';
    });
    html += '</tbody></table></div>';
    mount.innerHTML = html;
  }

  /* ---------------- checkpoint evaluation ---------------- */
  function evaluateChapter(ch) {
    var rt = runtime[ch.id];
    if (!rt) return;
    var quizOk = rt.quizIds.every(function (q) { return state.quiz[q] && state.quiz[q].ok; });
    var checkOk = true;
    if (rt.checkId && rt.checkTotal) {
      var arr = state.check[rt.checkId] || [];
      checkOk = arr.length === rt.checkTotal && arr.every(Boolean);
    }
    var examOk = ch.id !== 'exam' || !!state.exam.passed;
    var ready = quizOk && checkOk && examOk;
    var done = !!state.chapterDone[ch.id];

    var cp = $('#cp-' + ch.id);
    if (cp) {
      cp.classList.toggle('done', done);
      var st = $('[data-cp-status]', cp);
      if (st) {
        st.textContent = done ? 'пройден ✓' : (ready ? 'готов — засчитывается…' : 'не пройден');
        st.style.color = done ? 'var(--green)' : '';
      }
    }

    if (ready && !done) {
      state.chapterDone[ch.id] = true;
      saveState();
      toast('Чекпоинт раздела пройден: ' + ch.title, 'ok');
      confetti();
      updateProgressUI();
      updateNavDone();
    } else if (!ready && done) {
      // keep completed state — do not punish
    }
    updateNavDone();
  }

  /* ---------------- exam ---------------- */
  function initExam(root, ch) {
    var mount = $('#examMount', root);
    if (!mount) return;
    if (!EXAM.length) { mount.innerHTML = '<p class="muted">Вопросы не загружены.</p>'; return; }

    var answers = {};
    var submitted = false;
    var perms = [];

    function renderIntro() {
      var best = state.exam.best || 0;
      mount.innerHTML =
        '<div class="note info"><div class="note-ico">🎓</div><div class="note-body"><div class="note-title">Аттестация по материалам навигатора</div>' +
        '<p>' + EXAM.length + ' вопросов, порог — 80%. Можно проходить сколько угодно раз: сохраняется лучший результат. Вопросы покрывают методику, SDD, харнесс и роль AI-native аналитика.</p></div></div>' +
        (best ? '<p class="muted">Лучший результат: <b>' + best + ' / ' + EXAM.length + '</b></p>' : '') +
        '<div class="btn-row"><button class="btn btn-primary" type="button" data-exam-start>Начать аттестацию</button></div>' +
        '<div class="exam-result" id="examResult"></div>';
      $('[data-exam-start]', mount).addEventListener('click', renderQuestions);
    }

    function renderQuestions() {
      submitted = false; answers = {};
      mount.innerHTML = '<div class="exam-top"><span class="pill">0 / ' + EXAM.length + '</span><div class="exam-progress"><div class="exam-progress-fill" id="examFill" style="width:0%"></div></div>' +
        '<button class="btn btn-sm btn-primary" type="button" data-exam-submit disabled>Проверить</button></div>' +
        '<div id="examQs"></div>';
      var qs = $('#examQs', mount);
      perms = EXAM.map(function (q, i) { return permFor('exam-' + i, q.options.length); });
      qs.innerHTML = EXAM.map(function (q, i) {
        var perm = perms[i];
        return '<div class="exam-q" data-eq="' + i + '"><div class="n">Вопрос ' + (i + 1) + '</div>' +
          '<div class="qt">' + mdInline(q.q) + '</div><div class="exam-opts">' +
          perm.map(function (oi, j) {
            return '<label class="exam-opt"><input type="radio" name="eq' + i + '" value="' + j + '"><span>' + mdInline(q.options[oi]) + '</span></label>';
          }).join('') + '</div></div>';
      }).join('');

      qs.addEventListener('change', function (e) {
        var inp = e.target;
        if (!inp.matches('input[type=radio]')) return;
        var q = inp.closest('[data-eq]');
        q.querySelectorAll('.exam-opt').forEach(function (l) { l.classList.toggle('sel', l.contains(inp)); });
        answers[+q.dataset.eq] = +inp.value;
        var n = Object.keys(answers).length;
        $('.pill', mount).textContent = n + ' / ' + EXAM.length;
        $('#examFill', mount).style.width = (n / EXAM.length * 100) + '%';
        $('[data-exam-submit]', mount).disabled = n < EXAM.length;
      });

      $('[data-exam-submit]', mount).addEventListener('click', function () {
        if (submitted) return;
        submitted = true;
        var score = EXAM.reduce(function (acc, q, i) {
          return acc + (answers[i] === perms[i].indexOf(q.answer) ? 1 : 0);
        }, 0);
        var pct = Math.round(score / EXAM.length * 100);
        var passed = pct >= 80;
        var best = Math.max(state.exam.best || 0, score);
        state.exam.best = best;
        state.exam.last = score;
        state.exam.passed = !!state.exam.passed || passed;
        state.exam.date = new Date().toISOString();
        saveState();

        var review = EXAM.map(function (q, i) {
          var ok = answers[i] === perms[i].indexOf(q.answer);
          var given = (answers[i] != null) ? q.options[perms[i][answers[i]]] : null;
          return '<div class="exam-q"><div class="n">Вопрос ' + (i + 1) + ' ' + (ok ? '✅' : '❌') + '</div>' +
            '<div class="qt">' + mdInline(q.q) + '</div>' +
            '<div class="muted" style="font-size:13px">Твой ответ: ' + mdInline(given || '—') + '<br>Верно: ' + mdInline(q.options[q.answer]) + '</div>' +
            '<div class="quiz-explain show"><b>Почему:</b> ' + mdInline(q.explain || '') + '</div></div>';
        }).join('');

        var result = $('#examResult', mount) || document.createElement('div');
        result.className = 'exam-result show';
        result.innerHTML =
          '<div class="exam-score">' + pct + '%<small> · ' + score + ' из ' + EXAM.length + '</small></div>' +
          '<p style="margin:8px 0 0;font-size:14px;color:var(--text-2)">' + (passed ? 'Порог 80% пройден. Роль AI-native аналитика — твоя зона роста, переходи к практике на реальной задаче.' : 'Пока ниже порога. Перечитай разделы, где были ошибки, и попробуй снова — вопросов не боятся.') + '</p>' +
          (passed ? '<div class="cert"><div class="cert-sub">СЕРТИФИКАТ НАВИГАТОРА · AI-NATIVE SDLC</div>' +
            '<div class="cert-name" id="certName">Введи имя</div><div class="cert-line"></div>' +
            '<div class="cert-meta"><span>Результат: <b>' + score + ' / ' + EXAM.length + '</b></span><span>Порог: 80%</span><span>Дата: ' + new Date().toLocaleDateString('ru-RU') + '</span></div>' +
            '<div class="btn-row" style="margin-top:14px"><input id="certInput" placeholder="Твоё имя" style="flex:1;min-width:180px;padding:10px 12px;border-radius:9px;border:1px solid var(--line-strong);background:var(--panel);color:var(--text);font:inherit">' +
            '<button class="btn btn-primary btn-sm" type="button" id="certSave">Сохранить имя</button><button class="btn btn-ghost btn-sm" type="button" id="certPrint">Печать</button></div></div>' : '') +
          '<div class="btn-row" style="margin-top:14px"><button class="btn btn-primary" type="button" data-exam-retry>Пройти ещё раз</button></div>' +
          '<h3 style="margin-top:26px">Разбор ответов</h3>' + review;

        mount.innerHTML = '';
        mount.appendChild(result);
        if (passed) confetti();

        var retry = $('[data-exam-retry]', result);
        retry.addEventListener('click', renderIntro);

        var nameEl = $('#certName'), input = $('#certInput'), save = $('#certSave');
        if (nameEl && input) {
          if (state.exam.name) { nameEl.textContent = state.exam.name; input.value = state.exam.name; }
          save.addEventListener('click', function () {
            var v = (input.value || '').trim();
            if (!v) { toast('Введи имя', 'warn'); return; }
            state.exam.name = v; saveState();
            nameEl.textContent = v;
            toast('Имя сохранено', 'ok');
          });
          $('#certPrint').addEventListener('click', function () { window.print(); });
        }
        evaluateChapter(ch);
        updateProgressUI();
      });
    }

    renderIntro();
  }

  /* ---------------- progress ---------------- */
  function quizTotal() { var n = 0; CHAPTERS.forEach(function (c) { n += (c.quiz || []).length; }); return n; }
  function quizCorrect() { var n = 0; Object.keys(state.quiz).forEach(function (k) { if (state.quiz[k].ok) n++; }); return n; }
  function checkpointsTotal() { return CHAPTERS.filter(function (c) { return !!c.checkpoint; }).length; }
  function checkpointsDone() { return CHAPTERS.filter(function (c) { return !!c.checkpoint && state.chapterDone[c.id]; }).length; }

  function updateProgressUI() {
    var done = checkpointsDone(), total = checkpointsTotal();
    var pct = total ? Math.round(done / total * 100) : 0;

    var pctEl = $('#globalPct'); if (pctEl) pctEl.textContent = pct + '%';
    var ring = $('#ringFg');
    if (ring) {
      var c = 2 * Math.PI * 18;
      ring.style.strokeDasharray = c;
      ring.style.strokeDashoffset = c - c * pct / 100;
    }
    var sc = $('#sideCheckpoints'); if (sc) sc.textContent = done + ' / ' + total;
    var sq = $('#sideQuiz'); if (sq) sq.textContent = quizCorrect() + ' / ' + quizTotal();
    var lvl = $('#sideLevel');
    if (lvl) lvl.textContent = state.assess.lastLevel || (done ? 'в процессе' : '—');
    var fill = $('#sideFill'); if (fill) fill.style.width = pct + '%';
    updateNavDone();
  }

  function updateNavDone() {
    $$('.nav-item').forEach(function (a) {
      var id = a.getAttribute('href').replace('#/', '');
      a.classList.toggle('done', !!state.chapterDone[id]);
    });
  }

  function updateNavActive() {
    if (!currentChapter) return;
    $$('.nav-item').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#/' + currentChapter.id);
    });
  }

  /* ---------------- nav / routing ---------------- */
  function buildNav() {
    var nav = $('#nav');
    var lastPart = null;
    var html = '';
    CHAPTERS.forEach(function (c, i) {
      var partStart = c.part !== lastPart;
      lastPart = c.part;
      if (partStart) html += '<div class="nav-part-label">' + esc(c.part || '') + '</div>';
      html += '<a class="nav-item" href="#/' + c.id + '">' +
        '<span class="nav-num">' + (i + 1) + '</span><span class="nav-title">' + esc(c.title) + '</span>' +
        '<span class="nav-check">✓</span></a>';
    });
    nav.innerHTML = html;
    $$('.nav-item').forEach(function (a) {
      a.addEventListener('click', function () {
        if (window.innerWidth <= 900) closeSidebar();
      });
    });
  }

  function buildFooter() {
    var f = $('#footerLinks');
    if (!f) return;
    f.innerHTML = '<a href="#/start">Старт</a><a href="#/analyst">Роль AI-native аналитика</a><a href="#/map">Карта чекпоинтов</a><a href="#/exam">Аттестация</a>';
  }

  function go(id) {
    if (!id) id = 'start';
    if (chapterIndex(id) < 0) id = 'start';
    if (location.hash !== '#/' + id) { location.hash = '#/' + id; return; }
    renderChapter(CHAPTERS[chapterIndex(id)]);
  }

  function route() {
    var id = (location.hash || '').replace(/^#\//, '');
    if (!id) { location.replace('#/start'); return; }
    go(id);
  }

  /* ---------------- search ---------------- */
  function collectText(b, arr) {
    if (!b) return arr;
    if (typeof b === 'string') { arr.push(b); return arr; }
    if (Array.isArray(b)) { b.forEach(function (x) { collectText(x, arr); }); return arr; }
    ['x', 'title', 'text', 'q', 'a'].forEach(function (k) { if (typeof b[k] === 'string') arr.push(b[k]); });
    ['items', 'rows', 'head'].forEach(function (k) {
      if (Array.isArray(b[k])) b[k].forEach(function (it) { collectText(it, arr); });
    });
    if (b.left) collectText(b.left, arr);
    if (b.right) collectText(b.right, arr);
    if (b.blocks) b.blocks.forEach(function (x) { collectText(x, arr); });
    if (b.questions) b.questions.forEach(function (x) { collectText(x, arr); });
    return arr;
  }

  function stripMd(s) { return String(s).replace(/[`*_#>\[\]]/g, ' ').replace(/\s+/g, ' ').trim(); }

  function buildSearchIndex() {
    searchEntries = [];
    CHAPTERS.forEach(function (c) {
      searchEntries.push({ ch: c.id, chTitle: c.title, bIdx: 0, title: c.title, text: stripMd(c.lede || '') });
      (c.blocks || []).forEach(function (b, i) {
        var parts = collectText(b, []);
        var text = stripMd(parts.join(' '));
        if (text.length > 3) searchEntries.push({ ch: c.id, chTitle: c.title, bIdx: i, title: '', text: text });
      });
      (c.quiz || []).forEach(function (q) {
        searchEntries.push({ ch: c.id, chTitle: c.title, bIdx: -1, anchor: 'quiz-' + c.id, title: 'Квиз', text: stripMd(q.q + ' ' + q.options.join(' ') + ' ' + (q.explain || '')) });
      });
    });
    if (chapterIndex('glossary') >= 0) {
      GLOSSARY.forEach(function (g) {
        searchEntries.push({ ch: 'glossary', chTitle: 'Глоссарий', bIdx: -1, anchor: 'glossList', title: 'Глоссарий', text: stripMd(g.term + ' ' + (g.en || '') + ' ' + g.def) });
      });
    }
    if (chapterIndex('exam') >= 0) {
      EXAM.forEach(function (q, i) {
        searchEntries.push({ ch: 'exam', chTitle: 'Аттестация', bIdx: -1, anchor: 'examMount', title: 'Вопрос ' + (i + 1), text: stripMd(q.q + ' ' + q.options.join(' ') + ' ' + (q.explain || '')) });
      });
    }
    if (chapterIndex('lk-catalog') >= 0 && window.LK_CATALOG) {
      window.LK_CATALOG.forEach(function (it) {
        searchEntries.push({ ch: 'lk-catalog', chTitle: 'Каталог LK-контекста', bIdx: -1, anchor: 'lkList', title: 'LK ' + it.c, text: stripMd(it.c + ' ' + it.t + ' ' + (it.d || '') + ' ' + (it.g || '')) });
      });
    }
  }

  function openSearch() {
    var m = $('#searchModal');
    m.hidden = false;
    $('#searchInput').value = '';
    $('#searchResults').innerHTML = '<p class="search-hint">Начни вводить запрос — поиск идёт по всем разделам и блокам.</p>';
    setTimeout(function () { $('#searchInput').focus(); }, 40);
  }
  function closeSearch() { $('#searchModal').hidden = true; }

  function doSearch(q) {
    q = (q || '').trim().toLowerCase();
    var out = $('#searchResults');
    if (!q) { out.innerHTML = '<p class="search-hint">Начни вводить запрос — поиск идёт по всем разделам и блокам.</p>'; return; }
    var res = [];
    searchEntries.forEach(function (e) {
      var hay = (e.chTitle + ' ' + e.text).toLowerCase();
      if (hay.indexOf(q) >= 0) {
        var pos = e.text.toLowerCase().indexOf(q);
        var start = Math.max(0, pos - 50);
        var snip = e.text.slice(start, start + 150);
        res.push({ e: e, snip: snip, pos: pos });
      }
    });
    res = res.slice(0, 40);
    if (!res.length) { out.innerHTML = '<p class="search-hint">Ничего не найдено. Попробуй: контракт, гейт, контекст, skill, DORA.</p>'; return; }
    out.innerHTML = res.map(function (r, i) {
      var sn = esc(r.snip).replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
      return '<button class="sr" type="button" data-i="' + i + '"><div class="srt">' + esc(r.e.chTitle) + (r.e.title && r.e.title !== r.e.chTitle ? ' <em>' + esc(r.e.title) + '</em>' : '') + '</div>' +
        '<div class="srx">' + sn + '…</div></button>';
    }).join('');
    $$('.sr', out).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var r = res[+btn.dataset.i];
        closeSearch();
        pendingScroll = (r.e.anchor ? null : r.e.bIdx);
        pendingAnchor = r.e.anchor || null;
        if (location.hash === '#/' + r.e.ch) { renderChapter(CHAPTERS[chapterIndex(r.e.ch)]); }
        else { location.hash = '#/' + r.e.ch; }
      });
    });
  }

  /* ---------------- sidebar / theme / misc ---------------- */
  function openSidebar() { $('#sidebar').classList.add('open'); $('#sidebarBackdrop').classList.add('show'); }
  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#sidebarBackdrop').classList.remove('show'); }

  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    state.settings.theme = t;
    saveState();
  }
  function toggleTheme() {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }

  function exportProgress() {
    var payload = {
      project: 'ai-native-sdlc-navigator',
      exportedAt: new Date().toISOString(),
      progress: state
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ai-native-sdlc-progress.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast('Прогресс выгружен', 'ok');
  }

  function importProgressFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var p = (data && data.progress) ? data.progress : data;
        if (!p || typeof p !== 'object' || !p.chapterDone) throw new Error('bad format');
        var theme = state.settings.theme;
        var importedTheme = (p.settings && p.settings.theme);
        if (importedTheme !== 'light' && importedTheme !== 'dark') importedTheme = theme;
        state = {
          v: 1,
          chapterDone: p.chapterDone || {},
          quiz: p.quiz || {},
          check: p.check || {},
          assess: p.assess || {},
          exam: p.exam || {},
          settings: { theme: importedTheme }
        };
        saveState();
        document.documentElement.dataset.theme = state.settings.theme;
        updateProgressUI();
        if (currentChapter) renderChapter(currentChapter);
        toast('Прогресс загружен', 'ok');
      } catch (e) {
        toast('Не удалось прочитать файл прогресса', 'err');
      }
    };
    reader.onerror = function () { toast('Не удалось прочитать файл прогресса', 'err'); };
    reader.readAsText(file);
  }

  function resetProgress() {
    if (!confirm('Сбросить весь прогресс, ответы квизов и самопроверку? Это необратимо.')) return;
    var theme = state.settings.theme;
    state = { v: 1, chapterDone: {}, quiz: {}, check: {}, assess: {}, exam: {}, settings: { theme: theme } };
    saveState();
    updateProgressUI();
    if (currentChapter) renderChapter(currentChapter);
    toast('Прогресс сброшен', 'warn');
  }

  function initScrollProgress() {
    window.addEventListener('scroll', function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      var bar = $('#scrollBar');
      if (bar) bar.style.width = pct + '%';
    }, { passive: true });
  }

  function initKeyboard() {
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (e.key === '/' && !typing) { e.preventDefault(); openSearch(); return; }
      if (e.key === 'Escape') { closeSearch(); closeSidebar(); return; }
      if (typing) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        var idx = currentChapter ? chapterIndex(currentChapter.id) : 0;
        var n = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
        if (n >= 0 && n < CHAPTERS.length) { e.preventDefault(); location.hash = '#/' + CHAPTERS[n].id; }
      }
    });
  }

  /* ---------------- boot ---------------- */
  function boot() {
    if (!CHAPTERS.length) {
      $('#chapterMount').innerHTML = '<p>Контент не загружен: проверь файлы js/data-*.js</p>';
      return;
    }
    // порядок разделов задаётся отдельным файлом js/data-order.js
    if (window.SITE_ORDER && window.SITE_ORDER.length) {
      var pos = {};
      window.SITE_ORDER.forEach(function (id, i) { pos[id] = i; });
      CHAPTERS.sort(function (a, b) {
        var ia = pos[a.id] == null ? 999 : pos[a.id];
        var ib = pos[b.id] == null ? 999 : pos[b.id];
        return ia - ib;
      });
    }
    // theme
    var savedTheme = state.settings.theme;
    if (!savedTheme) {
      savedTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.dataset.theme = savedTheme;

    buildNav();
    buildFooter();
    buildSearchIndex();
    initScrollProgress();
    initKeyboard();

    $('#themeBtn').addEventListener('click', toggleTheme);
    $('#searchBtn').addEventListener('click', openSearch);
    $('#searchClose').addEventListener('click', closeSearch);
    $('#searchInput').addEventListener('input', function (e) { doSearch(e.target.value); });
    $('#searchModal').addEventListener('click', function (e) { if (e.target === $('#searchModal')) closeSearch(); });
    $('#exportBtn').addEventListener('click', exportProgress);
    $('#importBtn').addEventListener('click', function () { $('#importFile').click(); });
    $('#importFile').addEventListener('change', function (e) {
      importProgressFile(e.target.files && e.target.files[0]);
      e.target.value = '';
    });
    $('#resetBtn').addEventListener('click', resetProgress);
    $('#menuBtn').addEventListener('click', openSidebar);
    $('#sidebarBackdrop').addEventListener('click', closeSidebar);
    window.addEventListener('hashchange', route);

    // quick "герой" buttons may be injected with data-goto
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-goto]');
      if (a) { e.preventDefault(); location.hash = '#/' + a.dataset.goto; }
    });

    if (!location.hash || location.hash === '#') location.replace('#/start');
    else route();

    updateProgressUI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

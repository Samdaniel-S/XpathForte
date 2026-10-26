/* XPath Forte — site behaviour.
   Everything on the page is readable without this file; it adds smooth scrolling,
   entrances, the tabbed fragments and the live demo (the real engine, docs/engine.js,
   running inside a same-origin iframe so its match counts describe that page only). */

(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Smooth scroll (weight, never a page that keeps sliding) ---------- */
  let lenis = null;
  if (window.Lenis && !reduced && !touch) {
    lenis = new window.Lenis({ lerp: 0.12, smoothWheel: true, anchors: { offset: -80 }, autoRaf: true });
  }

  /* ---------- The bar steps aside on the way down, returns on the way up ---------- */
  const bar = $('#bar');
  let lastY = scrollY;
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      const away = y > 240 && y > lastY && !bar.contains(document.activeElement);
      bar.classList.toggle('is-away', away);
      lastY = y;
      ticking = false;
    });
  }, { passive: true });

  /* ---------- Copy to clipboard ---------- */
  const copy = async (text, btn) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = Object.assign(document.createElement('textarea'), { value: text });
      t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.append(t); t.select();
      try { document.execCommand('copy'); } catch { /* nothing else to try */ }
      t.remove();
    }
    if (!btn) return;
    const was = btn.textContent;
    btn.textContent = 'Copied';
    btn.classList.add('is-done');
    setTimeout(() => { btn.textContent = was; btn.classList.remove('is-done'); }, 1200);
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]');
    if (b) copy(b.dataset.copy, b);
  });

  /* ---------- Reveal once, as each part enters ---------- */
  const revealTargets = $$('[data-reveal], [data-slide], .bench__title');
  const reveal = (el) => el.classList.add('is-in');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    revealTargets.forEach((el) => io.observe(el));
    addEventListener('load', () => setTimeout(() => {
      revealTargets.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) reveal(el); });
    }, 2500));
  } else revealTargets.forEach(reveal);

  /* ---------- Headings whose lines rise on scroll ---------- */
  (() => {
    const els = $$('[data-lines]');
    if (!els.length || reduced || !('IntersectionObserver' in window)) return;
    const restore = (el) => { el.textContent = el.dataset.text; el.classList.remove('is-split', 'is-in'); };
    const split = (el) => {
      const text = el.textContent.trim().replace(/\s+/g, ' ');
      el.dataset.text = text;
      el.textContent = '';
      const words = text.split(' ').map((w) => {
        const s = document.createElement('span');
        s.style.display = 'inline-block';
        s.textContent = w;
        el.append(s, ' ');
        return s;
      });
      const lines = [];
      for (const w of words) {
        const last = lines.at(-1);
        if (last && Math.abs(last.top - w.offsetTop) < 4) last.words.push(w.textContent);
        else lines.push({ top: w.offsetTop, words: [w.textContent] });
      }
      el.textContent = '';
      lines.forEach((line, i) => {
        const mask = document.createElement('span');
        const inner = document.createElement('span');
        mask.className = 'line';
        inner.style.setProperty('--i', i);
        inner.textContent = line.words.join(' ');
        mask.append(inner);
        el.append(mask, ' ');
      });
      el.classList.add('is-split');
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        e.target.classList.add('is-in');
        const last = e.target.querySelector('.line:last-of-type > span');
        if (last) last.addEventListener('transitionend', () => restore(e.target), { once: true });
      }
    }, { rootMargin: '0px 0px -12% 0px' });
    document.fonts.ready.then(() => els.forEach((el) => { split(el); io.observe(el); }));
  })();

  /* ---------- Tabs: click, arrows, Home/End ---------- */
  const setupTabs = (list, onSelect) => {
    const tabs = $$('[role="tab"]', list);
    const vertical = list.getAttribute('aria-orientation') === 'vertical';
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      if (onSelect) onSelect(tab);
    };
    list.addEventListener('click', (e) => { const t = e.target.closest('[role="tab"]'); if (t) select(t); });
    list.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const next = vertical ? ['ArrowDown', 'ArrowRight'] : ['ArrowRight'];
      const prev = vertical ? ['ArrowUp', 'ArrowLeft'] : ['ArrowLeft'];
      let j = null;
      if (next.includes(e.key)) j = (i + 1) % tabs.length;
      else if (prev.includes(e.key)) j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j === null) return;
      e.preventDefault();
      select(tabs[j], true);
    });
    return { select: (id) => { const t = tabs.find((x) => x.dataset.tab === id || x.id === id); if (t) select(t); } };
  };

  /* ---------- Benchmark: bands arrive row by row, again on each tab ---------- */
  (() => {
    const list = $('.bench__tabs');
    if (!list) return;
    $$('.bands').forEach((ul) => $$('.band', ul).forEach((b, i) => b.style.setProperty('--i', i)));
    const play = (ul) => { ul.classList.remove('is-in'); void ul.offsetWidth; ul.classList.add('is-in'); };
    setupTabs(list, (tab) => play(document.getElementById(tab.getAttribute('aria-controls'))));
    const first = $('.bands:not([hidden])');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { play(first); io.disconnect(); }
      }, { rootMargin: '0px 0px -15% 0px' });
      io.observe(first);
    } else first.classList.add('is-in');
  })();

  /* ---------- The panel, part by part: notes level with their controls ---------- */
  (() => {
    const stage = $('.plate__stage');
    if (!stage) return;
    const panel = $('#plate-panel');
    const ring = $('.plate__ring');
    const holder = $('.plate__panel');
    setupTabs($('.xf-tabs', panel));
    const notes = $$('.note', stage);
    const targetOf = (note) => $(`[data-part="${note.dataset.target}"]`, panel);
    const wide = matchMedia('(min-width: 901px)');

    const place = () => {
      $$('.plate__notes', stage).forEach((col) => {
        const items = $$('.note', col);
        if (!wide.matches) {
          col.classList.remove('is-placed');
          col.style.minHeight = '';
          items.forEach((n) => { n.style.top = ''; });
          return;
        }
        col.classList.add('is-placed');
        const colTop = col.getBoundingClientRect().top;
        let floor = 0;
        items.forEach((n) => {
          const t = targetOf(n);
          if (!t) return;
          const r = t.getBoundingClientRect();
          const y = Math.max(Math.round(r.top - colTop - 4), floor);
          n.style.top = y + 'px';
          floor = y + n.offsetHeight + 28;
        });
        col.style.minHeight = floor + 'px';
      });
    };

    let pinned = null;
    const show = (note) => {
      notes.forEach((n) => n.classList.toggle('is-on', n === note));
      const t = note && targetOf(note);
      if (!t || t.offsetParent === null) { ring.classList.remove('is-on'); return; }
      const hr = holder.getBoundingClientRect();
      const r = t.getBoundingClientRect();
      const pad = 4;
      ring.style.width = r.width + pad * 2 + 'px';
      ring.style.height = r.height + pad * 2 + 'px';
      ring.style.transform = `translate(${r.left - hr.left - pad}px, ${r.top - hr.top - pad}px)`;
      ring.classList.add('is-on');
    };
    const rest = () => show(pinned);
    notes.forEach((n) => {
      const b = $('.note__btn', n);
      b.setAttribute('aria-pressed', 'false');
      n.addEventListener('mouseenter', () => show(n));
      n.addEventListener('mouseleave', rest);
      b.addEventListener('focus', () => show(n));
      b.addEventListener('blur', rest);
      b.addEventListener('click', () => {
        pinned = pinned === n ? null : n;
        notes.forEach((m) => $('.note__btn', m).setAttribute('aria-pressed', String(m === pinned)));
        show(pinned || n);
      });
    });
    document.fonts.ready.then(place);
    addEventListener('resize', () => { place(); rest(); });
    addEventListener('load', place);
  })();

  /* ---------- How it works: the statement in the middle drives the stage ---------- */
  (() => {
    const how = $('.how');
    const steps = $$('.step');
    const states = $$('.state');
    const board = $('.how__board');
    const now = $('#how-now');
    if (!steps.length) return;

    // Narrow screens: no held stage over the text; each statement carries its own picture.
    const narrow = matchMedia('(max-width: 900px)');
    const arrange = () => {
      how.classList.toggle('how--inline', narrow.matches);
      states.forEach((state, i) => {
        if (narrow.matches) {
          let shot = $('.step__shot', steps[i]);
          if (!shot) { shot = document.createElement('div'); shot.className = 'step__shot'; steps[i].append(shot); }
          shot.append(state);
        } else {
          board.append(state);
        }
      });
      $$('.step__shot').forEach((shot) => { if (!narrow.matches) shot.remove(); });
    };
    arrange();
    narrow.addEventListener('change', arrange);

    if (!('IntersectionObserver' in window)) return;
    const set = (i) => {
      steps.forEach((s, j) => s.classList.toggle('is-on', j === i));
      states.forEach((s, j) => s.classList.toggle('is-on', j === i));
      if (now) now.textContent = String(i + 1);
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) set(Number(e.target.dataset.step));
    }, { rootMargin: '-48% 0px -48% 0px' });
    steps.forEach((s) => io.observe(s));
  })();

  /* ---------- Questions: one answer, the large type ---------- */
  (() => {
    const items = $$('.qa');
    const answer = $('#faq-answer');
    if (!items.length) return;
    const wide = matchMedia('(min-width: 900px)');
    let current = items.find((q) => q.classList.contains('is-on')) || items[0];
    const select = (qa, toggle) => {
      if (!wide.matches && toggle && qa === current && qa.classList.contains('is-on')) {
        qa.classList.remove('is-on');
        $('button', qa).setAttribute('aria-expanded', 'false');
        return;
      }
      current = qa;
      items.forEach((q) => {
        const on = q === qa;
        q.classList.toggle('is-on', on);
        $('button', q).setAttribute('aria-expanded', String(on));
      });
      if (!answer) return;
      const html = $('.qa__a', qa).innerHTML;
      if (reduced) { answer.innerHTML = html; return; }
      answer.classList.add('is-swapping');
      setTimeout(() => { answer.innerHTML = html; answer.classList.remove('is-swapping'); }, 150);
    };
    if (answer) answer.innerHTML = $('.qa__a', current).innerHTML;
    items.forEach((qa) => {
      const b = $('button', qa);
      b.addEventListener('click', () => select(qa, true));
      b.addEventListener('focus', () => { if (wide.matches) select(qa); });
      b.addEventListener('mouseenter', () => { if (wide.matches && qa !== current) select(qa); });
    });
  })();

  /* =====================================================================
     The live demo: ship a build, see what holds
     ===================================================================== */
  (() => {
    const frame = $('#try-frame');
    const src = $('#try-src');
    if (!frame || !src) return;

    const SPECIMEN = `<form id="j_idt88" class="space-y-4">
  <label for="j_idt88:email">Work email</label>
  <input id="j_idt88:email" name="email"
    type="email" placeholder="you@company.com"
    class="w-full rounded-md border px-3"
    data-v-4a3f2b1c>
  <button id="j_idt88:submit"
    type="submit"
    class="rounded-md bg-sky-600 text-white"
    data-v-4a3f2b1c>Place order</button>
</form>`;

    const FRAME_CSS = `html{background:#fff}
body{margin:0;padding:22px 24px 26px;font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1f2328}
*{cursor:crosshair}
form{display:flex;flex-direction:column;gap:8px;max-width:340px;margin:0}
div{display:block}
label{font-size:14px;font-weight:500;color:#3d434b}
input,select,textarea{font:inherit;padding:9px 12px;border:1px solid #d0d5dc;border-radius:6px;color:#1f2328}
button{font:inherit;font-weight:500;margin-top:8px;align-self:flex-start;padding:10px 16px;border:0;border-radius:6px;background:#0f6fb8;color:#fff}
a{color:#0f6fb8}
h1,h2,h3{margin:0 0 6px;font-size:18px}
p{margin:0}`;

    const panel = $('#live');
    const tagEl = $('#live-tag');
    const log = $('#try-log');
    const hlHover = $('.try__hl--hover');
    const hlPick = $('.try__hl--pick');
    const hlTests = $('.try__hl-tests');
    const healInput = $('#live-heal');
    const healRows = $('#live-heal-rows');
    const testInput = $('#live-test-input');
    const testResult = $('#live-test-result');

    let doc = null;          // the specimen document
    let engine = null;       // window.XPathForteEngine inside the frame
    let target = null;       // the picked element
    let build = 1;
    let activeTab = 'xpath';
    let analysis = null;
    const sources = new Map(); // heal line -> where it came from

    healInput.placeholder = `//button[@id="submit"]\n#login-form .btn-primary\ngetByRole('button', { name: 'Submit' })`;
    healInput.setAttribute('data-lenis-prevent', '');
    src.setAttribute('data-lenis-prevent', '');
    $('.xf-body', panel).setAttribute('data-lenis-prevent', '');

    const tabs = setupTabs($('.xf-tabs', panel), (tab) => {
      activeTab = tab.dataset.tab;
      if (activeTab === 'scan') renderScan();
      else if (activeTab !== 'heal') renderList();
    });

    /* --- the specimen page --- */
    const clean = (html) => {
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      $$('script, style, link, meta, iframe, object, embed, base', parsed).forEach((n) => n.remove());
      $$('*', parsed.body).forEach((el) => {
        for (const a of [...el.attributes]) {
          if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
        }
      });
      return parsed.body.innerHTML;
    };
    const isWrapper = (el) => el.parentElement === doc.body && el.localName === 'div' && el.classList.contains('max-w-md');
    const elements = () => (doc ? $$('*', doc.body).filter((el) => !isWrapper(el)) : []);
    const fit = () => { if (doc) frame.style.height = Math.ceil(doc.body.getBoundingClientRect().height) + 'px'; };

    const placeBox = (box, el) => {
      if (!el || !doc || !el.isConnected) { box.classList.remove('is-on'); return; }
      const r = el.getBoundingClientRect();
      const p = 3;
      box.style.left = r.left - p + 'px';
      box.style.top = r.top - p + 'px';
      box.style.width = r.width + p * 2 + 'px';
      box.style.height = r.height + p * 2 + 'px';
      box.classList.add('is-on');
    };

    const render = (html) => {
      if (!doc) return;
      doc.body.innerHTML = clean(html);
      fit();
    };

    /* --- what DevTools would copy (Chrome's "Copy selector" / "Copy full XPath") --- */
    const devSelector = (el) => {
      const steps = [];
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        if (n.id) { steps.unshift('#' + CSS.escape(n.id)); break; }
        const tag = n.localName;
        if (tag === 'html') break;
        if (tag === 'body') { steps.unshift('body'); break; }
        const sibs = [...n.parentElement.children];
        steps.unshift(sibs.filter((s) => s.localName === tag).length > 1 ? `${tag}:nth-child(${sibs.indexOf(n) + 1})` : tag);
      }
      return steps.join(' > ');
    };
    const devFullXPath = (el) => {
      const steps = [];
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const same = n.parentElement ? [...n.parentElement.children].filter((s) => s.localName === n.localName) : [n];
        steps.unshift(same.length > 1 ? `${n.localName}[${same.indexOf(n) + 1}]` : n.localName);
      }
      return '/' + steps.join('/');
    };

    /* --- resolve any locator inside the specimen --- */
    const kindOf = (v) => (/^\(*\//.test(v) ? 'xpath' : /^(page\.)?getBy|^locator\(/.test(v) ? 'playwright' : 'css');
    const resolve = (value) => {
      const v = value.trim().replace(/^page\./, '');
      const kind = kindOf(v);
      try {
        if (kind === 'xpath') {
          const r = doc.evaluate(v, doc, null, 7 /* ORDERED_NODE_SNAPSHOT_TYPE */, null);
          const out = [];
          for (let i = 0; i < r.snapshotLength; i++) { const n = r.snapshotItem(i); if (n.nodeType === 1) out.push(n); }
          return { kind, els: out };
        }
        if (kind === 'playwright') return { kind, els: engine ? engine.resolve(v, 'playwright') : [] };
        return { kind, els: [...doc.querySelectorAll(v)] };
      } catch { return { kind, els: null }; }
    };
    const statusOf = (els, unique = 'Unique') => {
      if (els === null) return ['Invalid', 'is-none'];
      if (els.length === 1) return [unique, 'is-one'];
      if (els.length > 1) return [`${els.length} matches`, 'is-many'];
      return ['No match', 'is-none'];
    };

    /* --- the panel --- */
    const SECTION = {
      'Best Match': 'Recommended', 'Unique/ID-based': 'Recommended', 'Test ID': 'Test ID Selectors',
      'Text-based': 'Text based', 'Class-based': 'Class based', 'Attribute-based': 'Attribute based',
      'Multi-attribute': 'Attribute based', 'Sibling/Following': 'Relation based', 'Relation-based': 'Relation based',
      'Sibling-based': 'Relation based', 'Parent/Ancestor': 'Context-aware', 'Ancestor-based': 'Context-aware',
      'Context-aware': 'Context-aware', 'Context-based': 'Context-aware', 'Structural': 'Context-aware',
      'Collection/Index-based': 'Position based', 'Position-based': 'Position based', 'CSS-like Path': 'Context-aware',
      'ID-based': 'ID based', 'Role-based': 'Role based',
    };
    const badge = (n) => n === 1 ? '<span class="xf-match is-one">1 match</span>'
      : n > 1 ? `<span class="xf-match is-many">${n} matches</span>`
      : n === 0 ? '<span class="xf-match is-none">No match</span>' : '<span class="xf-match is-none">Invalid</span>';
    const stab = (s) => `<span class="xf-stab is-${s.level === 'medium' ? 'mid' : s.level}" title="Stability: ${s.score}/100"><span class="xf-dot"></span>${esc(s.label)}</span>`;
    const typeName = { xpath: 'XPath', css: 'CSS', playwright: 'Playwright' };

    const bestHtml = (b) => {
      if (!b) return '';
      const sure = b.matchCount === 1;
      return `<div class="xf-best${sure ? '' : ' is-warn'}">
        <p class="xf-best__label"><svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>Best Locator</p>
        <code class="xf-best__value">${esc(b.value)}</code>
        <div class="xf-meta">${badge(b.matchCount)}${stab(b.stability)}<span class="xf-type">${typeName[b.type]}</span><button type="button" class="xf-copy" data-copy="${esc(b.value)}">Copy</button></div>
      </div>`;
    };

    const renderList = () => {
      const host = $(`[data-panel="${activeTab}"]`, panel);
      if (!host || !analysis) return;
      const items = analysis[activeTab].slice(0, 8);
      const groups = new Map();
      for (const c of items) {
        const name = SECTION[c.category] || c.category;
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(c);
      }
      let html = bestHtml(analysis.best);
      if (!items.length) html += `<p class="xf-note">No ${typeName[activeTab]} locator fits this element.</p>`;
      for (const [name, list] of groups) {
        html += `<p class="xf-sec">${esc(name)}</p>`;
        html += list.map((c) => `<div class="xf-item"><code>${esc(c.value)}</code><div class="xf-meta">${badge(c.matchCount)}${stab(c.stability)}<button type="button" class="xf-copy" data-copy="${esc(c.value)}">Copy</button></div></div>`).join('');
      }
      host.innerHTML = html;
    };

    const renderScan = () => {
      if (!doc || !engine) return;
      const els = $$('a[href], button, input, select, textarea, [role="button"], [role="link"], [tabindex]', doc.body);
      const rows = els.map((el) => ({ el, best: engine.analyze(el).best })).filter((r) => r.best);
      $('#live-scan-count').textContent = `${rows.length} element${rows.length === 1 ? '' : 's'}`;
      $('#live-scan-rows').innerHTML = rows.map((r) => `<li><span class="xf-scan__tag">${r.el.localName}</span><code title="${esc(r.best.value)}">${esc(r.best.value)}</code></li>`).join('');
      $('#live-scan-copy').dataset.copy = rows.map((r) => r.best.value).join('\n');
    };

    const verify = () => {
      const lines = healInput.value.split('\n').map((l) => l.trim()).filter(Boolean);
      healRows.innerHTML = lines.map((line, i) => {
        const [text, cls] = statusOf(resolve(line).els);
        const from = sources.get(line);
        return `<li style="--i:${i}"><span class="xf-heal__line"><code title="${esc(line)}">${esc(line)}</code>${from ? `<span class="xf-heal__src">${esc(from)}</span>` : ''}</span><span class="xf-match ${cls}">${text}</span></li>`;
      }).join('');
    };

    const updateNav = () => {
      const can = {
        parent: target && target.parentElement && target.parentElement !== doc.body && !isWrapper(target.parentElement),
        prev: target && !!target.previousElementSibling,
        next: target && !!target.nextElementSibling,
        child: target && !!target.firstElementChild,
      };
      $$('[data-nav]', panel).forEach((b) => { b.disabled = !can[b.dataset.nav]; });
    };

    const refresh = () => {
      if (activeTab === 'scan') renderScan();
      else if (activeTab === 'heal') { if (healInput.value.trim()) verify(); }
      else renderList();
    };

    // A pick by hand shows that element's locators; a re-pick after an edit keeps the tab.
    const pick = (el, byHand) => {
      if (!el || !engine || el === doc.body || el === doc.documentElement || isWrapper(el)) return;
      target = el;
      tagEl.textContent = `<${el.localName}>`;
      analysis = engine.analyze(el);
      placeBox(hlPick, el);
      updateNav();
      if (byHand && (activeTab === 'heal' || activeTab === 'scan')) tabs.select('xpath');
      else refresh();
    };

    const pickIndex = (i) => {
      const els = elements();
      if (!els.length) { target = null; analysis = null; return; }
      pick(els[Math.min(Math.max(i, 0), els.length - 1)]);
    };
    const defaultTarget = () => elements().findIndex((el) => el.localName === 'button');

    /* --- shipping a build --- */
    const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
    const hex = () => Array.from({ length: 8 }, () => '0123456789abcdef'[rand(0, 15)]).join('');
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    const ship = () => {
      if (!engine || !target) return;
      const index = elements().indexOf(target);
      const tag = target.localName;
      const before = [
        [analysis.best ? analysis.best.value : null, `Best Locator, build ${build}`],
        [devSelector(target), `DevTools “Copy selector”, build ${build}`],
        [devFullXPath(target), `DevTools “Copy full XPath”, build ${build}`],
      ].filter(([v]) => v);

      let text = src.value;
      const changes = [];
      const ids = new Map();
      text = text.replace(/j_idt(\d+)/g, (m, n) => { if (!ids.has(n)) ids.set(n, String(rand(100, 999))); return 'j_idt' + ids.get(n); });
      if (ids.size) { const [a, b] = [...ids][0]; changes.push(`<code>j_idt${a}</code> became <code>j_idt${b}</code>`); }
      const hashes = new Map();
      text = text.replace(/data-v-([0-9a-f]{8})/g, (m, h) => { if (!hashes.has(h)) hashes.set(h, hex()); return 'data-v-' + hashes.get(h); });
      if (hashes.size) changes.push('the scoped-style hash changed');
      let reshuffled = false;
      text = text.replace(/class="([^"]*)"/g, (m, v) => {
        const parts = v.trim().split(/\s+/);
        if (parts.length > 1) reshuffled = true;
        return `class="${shuffle(parts).join(' ')}"`;
      });
      if (reshuffled) changes.push('classes were reshuffled');
      const wrapped = /^\s*<div class="[^"]*max-w-md[^"]*">\n([\s\S]*)\n<\/div>\s*$/.exec(text);
      if (wrapped) {
        text = wrapped[1].replace(/^ {2}/gm, '');
        changes.push('the layout wrapper was removed');
      } else {
        text = '<div class="mx-auto max-w-md">\n' + text.replace(/^/gm, '  ') + '\n</div>';
        changes.push('the form got a layout wrapper');
      }

      build += 1;
      src.value = text;
      render(text);
      pickIndex(index);

      sources.clear();
      before.forEach(([v, from]) => sources.set(v, from));
      healInput.value = before.map(([v]) => v).join('\n');
      tabs.select('heal');
      verify();

      const held = before.map(([v]) => {
        const els = resolve(v).els;
        return els && els.length === 1 && els[0] === target;
      });
      const kept = held[0] ? `Your build ${build - 1} Best Locator still finds the <code>&lt;${tag}&gt;</code>.` : `Your build ${build - 1} Best Locator no longer finds it.`;
      const devHeld = held.slice(1).filter(Boolean).length;
      const dev = devHeld === 0 ? 'Neither DevTools copy does.' : devHeld === 1 ? 'One of the two DevTools copies does.' : 'Both DevTools copies do too.';
      log.innerHTML = `<b>Build ${build} shipped:</b> ${changes.join(', ')}. ${kept} ${dev}`;
    };

    const reset = () => {
      build = 1;
      src.value = SPECIMEN;
      render(SPECIMEN);
      sources.clear();
      healInput.value = '';
      healRows.innerHTML = '';
      tabs.select('xpath');
      pickIndex(defaultTarget());
      log.textContent = 'Build 1. Click any part of the form.';
    };

    /* --- wiring --- */
    let typing = 0;
    src.addEventListener('input', () => {
      clearTimeout(typing);
      typing = setTimeout(() => {
        const index = target ? elements().indexOf(target) : defaultTarget();
        render(src.value);
        pickIndex(index < 0 ? 0 : index);
        if (activeTab === 'heal') verify();
      }, 280);
    });
    $('#try-ship').addEventListener('click', ship);
    $('#try-reset').addEventListener('click', reset);
    $('#live-heal-go').addEventListener('click', verify);
    $$('[data-nav]', panel).forEach((b) => b.addEventListener('click', () => {
      if (!target) return;
      const n = b.dataset.nav;
      pick(n === 'parent' ? target.parentElement : n === 'prev' ? target.previousElementSibling : n === 'next' ? target.nextElementSibling : target.firstElementChild, true);
    }));

    let testTimer = 0;
    $('#live-test').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = testInput.value.trim();
      if (!v || !doc) return;
      const { els } = resolve(v);
      const [text, cls] = statusOf(els, '1 match');
      testResult.hidden = false;
      testResult.className = 'xf-test__result' + (cls === 'is-one' ? '' : cls === 'is-many' ? ' is-many' : ' is-bad');
      testResult.textContent = text;
      hlTests.innerHTML = '';
      (els || []).forEach((el) => {
        const r = el.getBoundingClientRect();
        const s = document.createElement('span');
        Object.assign(s.style, { left: r.left - 2 + 'px', top: r.top - 2 + 'px', width: r.width + 4 + 'px', height: r.height + 4 + 'px' });
        hlTests.append(s);
      });
      clearTimeout(testTimer);
      testTimer = setTimeout(() => { hlTests.innerHTML = ''; }, 2600);
    });
    // Copying a locator also drops it into the test box, as the extension does.
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-copy]');
      if (b && !b.closest('.xf-scan__bar')) testInput.value = b.dataset.copy;
    });

    frame.addEventListener('load', () => {
      doc = frame.contentDocument;
      engine = frame.contentWindow.XPathForteEngine || null;
      if (!doc || !engine) { log.textContent = 'The demo could not start the engine in this browser.'; return; }
      src.value = SPECIMEN;
      render(SPECIMEN);
      pickIndex(defaultTarget());

      doc.addEventListener('mousemove', (e) => {
        const el = e.target;
        if (el === doc.body || el === doc.documentElement || isWrapper(el)) { hlHover.classList.remove('is-on'); return; }
        placeBox(hlHover, el);
      });
      doc.addEventListener('mouseleave', () => hlHover.classList.remove('is-on'));
      doc.addEventListener('click', (e) => { e.preventDefault(); pick(e.target, true); });
      doc.addEventListener('submit', (e) => e.preventDefault());
      doc.addEventListener('focusin', (e) => pick(e.target, true));
      addEventListener('resize', () => { fit(); placeBox(hlPick, target); });
    });

    frame.srcdoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${FRAME_CSS}</style><script src="engine.js"><\/script></head><body></body></html>`;
  })();
})();

import { ctx, clamp } from '../ctx';
import { tr, L, lang } from '../i18n';
import { sfx } from '../audio';
import { writeSave, clearSave, defaultSave } from '../save';
import { ITEMS, SLOTS, itemsFor, isOwned, key, furColor, type Item, type Slot } from '../cosmetics';
import { MISCHIEF, AREA_KEY } from '../game/mischief';
import { FISH } from '../game/fishing';
import { input } from '../input';

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

export function faceSVG(kind: 'cat' | 'lisa' | 'mama', fur?: number) {
  if (kind === 'mama') {
    return `<svg viewBox="0 0 64 64" width="100%" height="100%"><rect width="64" height="64" fill="#ffe3ef"/><rect x="8" y="6" width="48" height="58" rx="6" fill="#f06292"/><rect x="16" y="16" width="32" height="34" rx="3" fill="#d9a877"/><rect x="22" y="26" width="5" height="7" fill="#1d1d24"/><rect x="37" y="26" width="5" height="7" fill="#1d1d24"/><rect x="18" y="35" width="6" height="3" fill="#f29b9b"/><rect x="40" y="35" width="6" height="3" fill="#f29b9b"/><rect x="26" y="40" width="12" height="3" fill="#7a2a2a"/><rect x="24" y="38" width="3" height="3" fill="#7a2a2a"/><rect x="37" y="38" width="3" height="3" fill="#7a2a2a"/><rect x="8" y="50" width="48" height="14" fill="#7e57c2"/></svg>`;
  }
  const f = hex(fur ?? (kind === 'lisa' ? 0xf6f3ec : 0xf2a044));
  const eye = kind === 'lisa' ? '#49a6f2' : '#6fcf5a';
  const extra =
    kind === 'lisa'
      ? `<rect x="36" y="14" width="18" height="12" fill="#f2a044"/><rect x="42" y="4" width="16" height="10" fill="#ff5fa2" transform="rotate(-15 50 9)"/><rect x="48" y="6" width="6" height="6" fill="#d9368a"/>`
      : '';
  return `<svg viewBox="0 0 64 64" width="100%" height="100%"><rect width="64" height="64" fill="#d7eeff"/><rect x="9" y="6" width="13" height="16" fill="${f}" transform="rotate(-10 15 14)"/><rect x="42" y="6" width="13" height="16" fill="${f}" transform="rotate(10 48 14)"/><rect x="12" y="10" width="6" height="8" fill="#f5a3b5" transform="rotate(-10 15 14)"/><rect x="46" y="10" width="6" height="8" fill="#f5a3b5" transform="rotate(10 48 14)"/><rect x="6" y="16" width="52" height="44" rx="5" fill="${f}"/>${extra}<rect x="17" y="28" width="9" height="11" fill="${eye}"/><rect x="38" y="28" width="9" height="11" fill="${eye}"/><rect x="20" y="29" width="4" height="9" fill="#15151c"/><rect x="41" y="29" width="4" height="9" fill="#15151c"/><rect x="22" y="29" width="2" height="2" fill="#fff"/><rect x="43" y="29" width="2" height="2" fill="#fff"/><rect x="22" y="40" width="20" height="12" fill="#fff" opacity=".45"/><rect x="29" y="41" width="6" height="4" fill="#f27a9a"/><rect x="27" y="47" width="4" height="2" fill="#4a2f2a"/><rect x="33" y="47" width="4" height="2" fill="#4a2f2a"/></svg>`;
}

const ICON: Record<string, string> = {
  'pattern:polos': '⬜',
  'pattern:kauskaki': '🧦',
  'pattern:belang': '🐯',
  'pattern:tutul': '🐆',
  'pattern:tuxedo': '🤵',
  'pattern:calico': '🎨',
  'head:none': '✖️',
  'head:pita': '🎀',
  'head:bunga': '🌼',
  'head:koboi': '🤠',
  'head:topiPesta': '🥳',
  'head:mahkota': '👑',
  'face:none': '✖️',
  'face:bulat': '🤓',
  'face:hitamK': '🕶️',
  'face:hati': '😍',
  'neck:none': '✖️',
  'neck:kalung': '⭕',
  'neck:lonceng': '🔔',
  'neck:syal': '🧣',
  'neck:dasi': '👔',
  'back:none': '✖️',
  'back:ransel': '🎒',
  'back:sayap': '👼',
  'back:jubah': '🦸',
};

type Line = { who: string; text: string; face: 'cat' | 'lisa' | 'mama' };

export class UI {
  toastBox = $('toasts');
  hintT: any = null;
  dialogQ: Line[] = [];
  dialogDone: (() => void) | null = null;
  typing: { full: string; i: number; t: number } | null = null;
  styleSlot: Slot = 'fur';
  styleSel: Item | null = null;
  styleBackup: any = null;
  lastCoins = -1;
  bookTab: 'm' | 'f' = 'm';

  constructor() {
    this.bindHud();
  }

  // ---------------- HUD ----------------
  bindHud() {
    $('btnPause').addEventListener('click', () => {
      sfx.click();
      this.pause();
    });
    $('btnMap').addEventListener('click', () => {
      sfx.click();
      this.map(true);
    });
    $('questCard').addEventListener('click', () => {
      sfx.click();
      ctx.save.settings.arrow = !ctx.save.settings.arrow;
      writeSave(ctx.save);
      this.toast((ctx.save.settings.arrow ? '🧭 ' : '🚫 ') + tr('arrow') + ': ' + tr(ctx.save.settings.arrow ? 'on' : 'off'));
    });
    $('fishExit').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      ctx.fishing.exitReq = true;
    });
    $('dialog').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.dialogNext();
    });
    window.addEventListener('keydown', (e) => {
      if (!$('dialog').hidden && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) {
        e.preventDefault();
        this.dialogNext();
      }
    });
    this.labels();
  }

  labels() {
    $('jumpLbl').textContent = tr('jump');
    $('meowLbl').textContent = tr('meow');
    $('joyHint').textContent = lang() === 'id' ? 'geser' : 'drag';
  }

  hud(on: boolean) {
    $('hud').hidden = !on;
    if (on) {
      this.coins();
      this.quest();
      this.labels();
    }
  }

  coins(delta = 0) {
    const n = ctx.save.coins;
    $('coinN').textContent = String(n);
    if (delta > 0) {
      const el = $('coins');
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
    document.querySelectorAll('.coins-live').forEach((e) => (e.textContent = String(n)));
  }

  quest() {
    const q = ctx.quests;
    if (!q) return;
    const txt = q.cardText();
    if ($('questText').textContent !== txt) $('questText').textContent = txt;
    if (!$('questFace').firstChild) $('questFace').innerHTML = faceSVG('lisa');
    $('questCard').classList.toggle('ready', ctx.save.quest.stage === 'ready' || q.canGive());
  }

  timer(frac: number, left: number) {
    const k = clamp(1 - frac, 0, 1);
    $('daySun').style.left = (k * 100).toFixed(1) + '%';
    $('dayFill').style.width = (k * 100).toFixed(1) + '%';
    $('dayLabel').textContent = tr('day', { n: ctx.day.n });
    $('daybar').classList.toggle('hurry', left < 45);
  }

  updateAction() {
    const btn = $('btnAct');
    let icon = '🐾', label = tr('noAction'), idle = true, hot = false;
    if (ctx.fishing?.active) {
      icon = '🎣';
      label = tr('tap');
      idle = false;
      hot = ctx.fishing.phase === 'bite' || ctx.fishing.phase === 'reel';
    } else {
      const cur = ctx.interact.current;
      if (cur) {
        icon = typeof cur.icon === 'function' ? cur.icon() : cur.icon;
        label = tr(typeof cur.label === 'function' ? cur.label() : cur.label);
        idle = false;
        hot = !!cur.mischief && !ctx.day.doneToday.has(cur.mischief);
      }
    }
    if ($('actIco').textContent !== icon) $('actIco').textContent = icon;
    if ($('actLbl').textContent !== label) $('actLbl').textContent = label;
    btn.classList.toggle('idle', idle);
    btn.classList.toggle('hot', hot);
  }

  toast(text: string, secs = 2.2) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.toastBox.appendChild(el);
    while (this.toastBox.children.length > 3) this.toastBox.firstChild!.remove();
    setTimeout(() => el.remove(), secs * 1000);
  }

  hint(text: string, secs = 5) {
    const el = $('hint');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.hintT);
    this.hintT = setTimeout(() => (el.hidden = true), secs * 1000);
  }

  area(name: string) {
    const el = $('areaTag');
    el.hidden = true;
    void el.offsetWidth;
    el.textContent = name;
    el.hidden = false;
    clearTimeout((el as any)._t);
    (el as any)._t = setTimeout(() => (el.hidden = true), 2400);
  }

  banner(icon: string, title: string, sub: string, coins: number) {
    const el = $('banner');
    el.innerHTML = `<div class="bi">${icon}</div><div><div class="bt">${esc(title)}</div><div class="bs">${esc(sub)}</div></div>${coins ? `<div class="bc">+${coins} 🐟</div>` : ''}`;
    el.hidden = true;
    void el.offsetWidth;
    el.hidden = false;
    clearTimeout((el as any)._t);
    (el as any)._t = setTimeout(() => (el.hidden = true), 2600);
  }

  bigTitle(text: string) {
    const el = $('bigTitle');
    el.textContent = text;
    el.hidden = true;
    void el.offsetWidth;
    el.hidden = false;
    setTimeout(() => (el.hidden = true), 1900);
  }

  fade(on: boolean, text = '') {
    const el = $('fade');
    el.textContent = text;
    el.classList.toggle('on', on);
  }
  fadeAsync(on: boolean, text = '') {
    this.fade(on, text);
    return new Promise<void>((r) => setTimeout(r, 650));
  }

  skip(on: boolean, fn?: () => void) {
    const b = $('skipBtn');
    b.hidden = !on;
    b.textContent = tr('skip') + ' ⏭';
    b.onclick = () => {
      sfx.click();
      fn?.();
      b.hidden = true;
    };
  }

  // fishing panel
  fishing(on: boolean) {
    $('fishPanel').hidden = !on;
    $('fishBarWrap').style.visibility = 'hidden';
  }
  fishStatus(t: string, hot: boolean) {
    const el = $('fishStatus');
    el.textContent = t;
    el.classList.toggle('hot', hot);
    if (!hot || ctx.fishing.phase !== 'reel') $('fishBarWrap').style.visibility = ctx.fishing.phase === 'reel' ? 'visible' : 'hidden';
  }
  fishBar(c: number, w: number, m: number) {
    $('fishBarWrap').style.visibility = 'visible';
    const z = $('fishZone');
    z.style.left = ((c - w / 2) * 100).toFixed(1) + '%';
    z.style.width = (w * 100).toFixed(1) + '%';
    $('fishMk').style.left = (m * 100).toFixed(1) + '%';
  }

  // ---------------- dialog ----------------
  dialog(lines: Line[], done: () => void) {
    this.dialogQ = [...lines];
    this.dialogDone = done;
    ctx.dialogOpen = true;
    $('dialog').hidden = false;
    this.showLine();
  }
  dialogAsync(lines: Line[]) {
    return new Promise<void>((r) => this.dialog(lines, r));
  }
  showLine() {
    const l = this.dialogQ[0];
    if (!l) return;
    $('dlgFace').innerHTML = faceSVG(l.face, l.face === 'cat' ? furColor(ctx.save.look.fur) : undefined);
    $('dlgWho').textContent = l.who;
    $('dlgTxt').textContent = '';
    $('dlgNext').textContent = tr('tapNext') + ' ▶';
    this.typing = { full: l.text, i: 0, t: 0 };
  }
  dialogNext() {
    if (!ctx.dialogOpen) return;
    if (this.typing && this.typing.i < this.typing.full.length) {
      this.typing.i = this.typing.full.length;
      $('dlgTxt').textContent = this.typing.full;
      return;
    }
    sfx.click();
    this.dialogQ.shift();
    if (this.dialogQ.length) this.showLine();
    else {
      $('dialog').hidden = true;
      ctx.dialogOpen = false;
      this.typing = null;
      const d = this.dialogDone;
      this.dialogDone = null;
      input.consume();
      d?.();
    }
  }
  updateDialog(dt: number) {
    const t = this.typing;
    if (!t || t.i >= t.full.length) return;
    t.t += dt;
    const n = Math.floor(t.t * 42);
    if (n > t.i) {
      t.i = Math.min(t.full.length, n);
      $('dlgTxt').textContent = t.full.slice(0, t.i);
      const face = this.dialogQ[0]?.face;
      sfx.voice(face === 'mama' ? 1.1 : face === 'lisa' ? 1.8 : 1.5, 0.05);
    }
  }

  // ---------------- modal ----------------
  confirm(text: string, yes: string, no: string, onYes: () => void, onNo?: () => void) {
    const m = $('modal');
    ctx.dialogOpen = true;
    m.innerHTML = `<div class="panel confirm"><p>${esc(text)}</p><div class="row"><button class="btn" id="cNo">${esc(no)}</button><button class="btn primary" id="cYes">${esc(yes)}</button></div></div>`;
    m.hidden = false;
    const close = () => {
      m.hidden = true;
      m.innerHTML = '';
      ctx.dialogOpen = false;
      input.consume();
    };
    $('cYes').onclick = () => {
      sfx.click();
      close();
      onYes();
    };
    $('cNo').onclick = () => {
      sfx.click();
      close();
      onNo?.();
    };
  }
  hideModals() {
    $('modal').hidden = true;
    if (ctx.paused) this.resume();
  }

  // ---------------- screens ----------------
  showScreen(html: string | null, cls = '') {
    const s = $('screen');
    if (html === null) {
      s.hidden = true;
      s.innerHTML = '';
      return s;
    }
    s.className = cls;
    s.innerHTML = html;
    s.hidden = false;
    return s;
  }

  title() {
    ctx.mode = 'menu';
    ctx.paused = false;
    this.hud(false);
    sfx.setTrack('menu');
    const d = ctx.save.day;
    this.showScreen(`
      <div class="coins-mini title-coins">🐟 <span class="coins-live">${ctx.save.coins}</span></div>
      <div class="title-wrap">
        <div class="logo">
          <div class="l1">${esc(tr('title1'))}</div>
          <div class="l2">${esc(tr('title2'))}</div>
          <div class="l3">${lang() === 'id' ? 'Kabur, bikin kacau, pulang sebelum sore!' : 'Sneak out, make a mess, be home by evening!'}</div>
        </div>
        <div class="menu-col">
          <button class="btn primary" id="mPlay">▶ ${esc(d > 1 ? tr('continueDay', { n: d }) : tr('play'))}</button>
          <button class="btn" id="mStyle">🎨 ${esc(tr('style'))}</button>
          <button class="btn" id="mBook">📖 ${esc(tr('book'))}</button>
          <button class="btn" id="mSet">⚙️ ${esc(tr('settings'))}</button>
        </div>
      </div>`);
    ctx.menuCam('title');
    $('mPlay').onclick = () => {
      sfx.unlock();
      sfx.click();
      if (ctx.save.firstRun && !ctx.save.metLisa && ctx.save.day === 1 && !ctx.styledOnce) {
        ctx.styledOnce = true;
        this.style(true);
      } else ctx.startDay();
    };
    $('mStyle').onclick = () => {
      sfx.unlock();
      sfx.click();
      this.style(false);
    };
    $('mBook').onclick = () => {
      sfx.unlock();
      sfx.click();
      this.book();
    };
    $('mSet').onclick = () => {
      sfx.unlock();
      sfx.click();
      this.settings(() => this.title());
    };
  }

  // ---------- style / shop ----------
  style(first: boolean) {
    ctx.mode = 'menu';
    ctx.menuCam('style');
    this.styleBackup = { ...ctx.save.look };
    this.styleSlot = 'fur';
    const render = () => {
      const s = ctx.save;
      const slot = this.styleSlot;
      const items = itemsFor(slot);
      const tabs = (first ? (['fur', 'eyes'] as Slot[]) : SLOTS).map((sl) => `<button class="tab ${sl === slot ? 'on' : ''}" data-slot="${sl}">${esc(tr('slot_' + sl))}</button>`).join('');
      const tiles = items
        .map((it) => {
          const owned = isOwned(it);
          const worn = (s.look as any)[slot] === it.id;
          const sel = this.styleSel && key(this.styleSel) === key(it);
          let sw: string;
          if (slot === 'fur') sw = `<div class="sw" style="background:${hex(it.color!)}"></div>`;
          else if (slot === 'eyes') sw = `<div class="sw" style="background:linear-gradient(90deg, ${hex(it.color!)} 50%, ${hex(it.color2 ?? it.color!)} 50%)"></div>`;
          else sw = `<div class="sw">${ICON[key(it)] ?? '•'}</div>`;
          const st = worn ? `<span class="st own">✓ ${esc(tr('wearing'))}</span>` : owned ? `<span class="st own">${esc(tr('wear'))}</span>` : it.quest ? `<span class="st">🔒 Lisa</span>` : `<span class="st">🐟 ${it.price}</span>`;
          return `<button class="tile ${sel ? 'sel' : ''} ${owned ? '' : 'locked'}" data-k="${key(it)}">${sw}<span>${esc(L(it.name))}</span>${st}</button>`;
        })
        .join('');
      const sel = this.styleSel;
      let bar = '';
      if (sel) {
        const owned = isOwned(sel);
        const worn = (s.look as any)[sel.slot] === sel.id;
        let btn: string;
        if (worn) btn = `<button class="btn small" disabled>✓ ${esc(tr('wearing'))}</button>`;
        else if (owned) btn = `<button class="btn small green" id="selAct">${esc(tr('wear'))}</button>`;
        else if (sel.quest) btn = `<button class="btn small" disabled>🔒 ${esc(tr('questLock'))}</button>`;
        else btn = `<button class="btn small primary" id="selAct" ${s.coins < sel.price ? 'data-poor="1"' : ''}>${esc(tr('buy'))} 🐟 ${sel.price}</button>`;
        bar = `<div class="sel-bar"><span class="nm">${esc(L(sel.name))}</span>${btn}</div>`;
      }
      this.showScreen(`
        <div class="panel style-panel">
          <div class="panel-head"><h2>${esc(first ? tr('firstStyleTitle') : tr('style'))}</h2><div class="coins-mini">🐟 <span class="coins-live">${s.coins}</span></div></div>
          ${first ? `<div style="font-weight:700;margin-top:-6px">${esc(tr('firstStyleSub'))}</div>` : ''}
          <label class="name-row">${esc(tr('catName'))}<input id="catName" maxlength="14" value="${esc(s.name)}" autocomplete="off" enterkeyhint="done"></label>
          <div class="tabs">${tabs}</div>
          <div class="grid">${tiles}</div>
          ${bar}
          <button class="btn primary" id="styleDone">${esc(first ? tr('play') + ' ▶' : tr('done'))}</button>
        </div>`);
      const nameIn = $('catName') as HTMLInputElement;
      nameIn.addEventListener('pointerdown', (e) => e.stopPropagation());
      nameIn.addEventListener('input', () => {
        const v = nameIn.value.trim().slice(0, 14);
        s.name = v || 'Meong';
        writeSave(s);
      });
      document.querySelectorAll('.tab').forEach(
        (b) =>
          ((b as HTMLElement).onclick = () => {
            sfx.click();
            this.styleSlot = (b as HTMLElement).dataset.slot as Slot;
            this.styleSel = null;
            ctx.cat.model.setLook(ctx.save.look);
            render();
          }),
      );
      document.querySelectorAll('.tile').forEach(
        (b) =>
          ((b as HTMLElement).onclick = () => {
            sfx.pop();
            const k = (b as HTMLElement).dataset.k!;
            const it = ITEMS.find((i) => key(i) === k)!;
            this.styleSel = it;
            // try it on
            const look = { ...ctx.save.look, [it.slot]: it.id };
            ctx.cat.model.setLook(look);
            if (isOwned(it)) {
              (ctx.save.look as any)[it.slot] = it.id;
              writeSave(ctx.save);
            }
            ctx.fx.sparkle(ctx.cat.body.x, ctx.cat.body.y + 0.6, ctx.cat.body.z, 4);
            render();
          }),
      );
      const act = document.getElementById('selAct');
      if (act && sel)
        act.onclick = () => {
          if (!isOwned(sel)) {
            if (s.coins < sel.price) {
              sfx.deny();
              this.toast('🐟 ' + tr('notEnough'));
              return;
            }
            s.coins -= sel.price;
            s.owned[key(sel)] = true;
            sfx.coin();
            this.toast(tr('bought', { item: L(sel.name) }));
          } else sfx.click();
          (s.look as any)[sel.slot] = sel.id;
          writeSave(s);
          ctx.cat.model.setLook(s.look);
          ctx.fx.sparkle(ctx.cat.body.x, ctx.cat.body.y + 0.6, ctx.cat.body.z, 8);
          this.coins();
          render();
        };
      $('styleDone').onclick = () => {
        sfx.click();
        this.styleSel = null;
        ctx.cat.model.setLook(ctx.save.look);
        writeSave(ctx.save);
        if (first) ctx.startDay();
        else if (ctx.returnToPause) {
          ctx.returnToPause = false;
          this.pause();
        } else this.title();
      };
    };
    this.styleSel = null;
    render();
  }

  // ---------- mischief book ----------
  book(fromPause = false) {
    const s = ctx.save;
    const render = () => {
      let body = '';
      if (this.bookTab === 'm') {
        const found = MISCHIEF.filter((m) => s.mischief[m.id]).length;
        body += `<div class="prog">${esc(tr('bookProgress', { a: found, b: MISCHIEF.length }))}</div>`;
        for (const area of ['rumah', 'taman', 'jalan', 'pasar', 'atap']) {
          const list = MISCHIEF.filter((m) => m.area === area);
          body += `<div class="area-h">${esc(tr(AREA_KEY[area]))}</div><div class="cards">`;
          for (const m of list) {
            const n = s.mischief[m.id] || 0;
            if (n) body += `<div class="mcard"><span class="mi">${m.icon}</span><span>${esc(L(m.name))}</span><span class="cnt">${n}x</span></div>`;
            else body += `<div class="mcard unk"><span class="mi">❔</span><span>${esc(tr('unknown'))}</span></div>`;
          }
          body += `</div>`;
        }
      } else {
        const found = FISH.filter((f) => s.fish[f.id]).length;
        body += `<div class="prog">${esc(tr('bookProgress', { a: found, b: FISH.length }))} · ${lang() === 'id' ? 'Total tangkapan' : 'Total catches'}: ${s.stats.fishTotal}</div><div class="cards" style="margin-top:8px">`;
        for (const f of FISH) {
          const n = s.fish[f.id] || 0;
          if (n) body += `<div class="mcard"><span class="mi">${f.icon}</span><span>${esc(L(f.name))}</span><span class="cnt">${n}x</span></div>`;
          else body += `<div class="mcard unk"><span class="mi">❔</span><span>${esc(tr('unknown'))}</span></div>`;
        }
        body += `</div>`;
      }
      this.showScreen(
        `<div class="screen-center shade"><div class="panel book-panel">
          <div class="panel-head"><h2>📖 ${esc(tr('book'))}</h2><button class="btn small" id="bBack">${esc(tr('back'))}</button></div>
          <div class="tabs"><button class="tab ${this.bookTab === 'm' ? 'on' : ''}" id="tM">${esc(tr('tabMischief'))}</button><button class="tab ${this.bookTab === 'f' ? 'on' : ''}" id="tF">🎣 ${esc(tr('tabFish'))}</button></div>
          <div class="book-body">${body}</div>
        </div></div>`,
      );
      $('tM').onclick = () => {
        sfx.click();
        this.bookTab = 'm';
        render();
      };
      $('tF').onclick = () => {
        sfx.click();
        this.bookTab = 'f';
        render();
      };
      $('bBack').onclick = () => {
        sfx.click();
        if (fromPause) this.pause();
        else this.title();
      };
    };
    render();
  }

  // ---------- settings ----------
  settings(back: () => void) {
    const s = ctx.save.settings;
    const render = () => {
      const seg = (id: string, opts: [string, string][], cur: string) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${v === cur ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
      this.showScreen(
        `<div class="screen-center shade"><div class="panel settings-panel">
          <div class="panel-head"><h2>⚙️ ${esc(tr('settings'))}</h2><button class="btn small" id="sBack">${esc(tr('back'))}</button></div>
          <div class="set-row"><span>${esc(tr('language'))}</span>${seg('sLang', [['id', 'Indonesia'], ['en', 'English']], s.lang)}</div>
          <div class="set-row"><label for="sMusic">${esc(tr('music'))}</label><input type="range" id="sMusic" min="0" max="1" step="0.05" value="${s.music}"></div>
          <div class="set-row"><label for="sSfx">${esc(tr('sfx'))}</label><input type="range" id="sSfx" min="0" max="1" step="0.05" value="${s.sfx}"></div>
          <div class="set-row"><span>${esc(tr('graphics'))}</span>${seg('sQ', [['low', tr('gLow')], ['high', tr('gHigh')]], s.quality)}</div>
          <div class="set-row"><span>${esc(tr('dayLength'))}</span>${seg('sDay', [['180', tr('min', { n: 3 })], ['300', tr('min', { n: 5 })], ['480', tr('min', { n: 8 })]], String(s.dayLen))}</div>
          <div class="set-row"><span>${esc(tr('arrow'))}</span>${seg('sArrow', [['1', tr('on')], ['0', tr('off')]], s.arrow ? '1' : '0')}</div>
          <div class="set-row"><span>${esc(tr('fullscreen'))}</span><button class="btn small" id="sFull">⛶</button></div>
          <div class="set-row" style="border:0"><span></span><button class="btn small pink" id="sReset">${esc(tr('resetData'))}</button></div>
        </div></div>`,
      );
      const segBind = (id: string, fn: (v: string) => void) =>
        document.querySelectorAll(`#${id} button`).forEach(
          (b) =>
            ((b as HTMLElement).onclick = () => {
              sfx.click();
              fn((b as HTMLElement).dataset.v!);
              writeSave(ctx.save);
              render();
            }),
        );
      segBind('sLang', (v) => {
        s.lang = v as any;
        s.langChosen = true;
        this.labels();
        document.documentElement.lang = v;
      });
      segBind('sQ', (v) => {
        s.quality = v as any;
        ctx.applyQuality();
      });
      segBind('sDay', (v) => (s.dayLen = Number(v)));
      segBind('sArrow', (v) => (s.arrow = v === '1'));
      const rng = (id: string, fn: (v: number) => void) => {
        const el = $(id) as HTMLInputElement;
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
        el.oninput = () => {
          fn(Number(el.value));
          sfx.applyVolumes();
        };
        el.onchange = () => {
          writeSave(ctx.save);
          sfx.coin();
        };
      };
      rng('sMusic', (v) => (s.music = v));
      rng('sSfx', (v) => (s.sfx = v));
      $('sFull').onclick = () => {
        sfx.click();
        try {
          if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
          else document.exitFullscreen?.();
        } catch (e) {}
      };
      $('sReset').onclick = () => {
        sfx.click();
        this.confirm(tr('resetConfirm'), tr('yes'), tr('no'), () => {
          clearSave();
          const keepLang = s.lang;
          const keepChosen = s.langChosen;
          ctx.save = defaultSave();
          ctx.save.settings.lang = keepLang;
          ctx.save.settings.langChosen = keepChosen;
          ctx.cat.model.setLook(ctx.save.look);
          ctx.quests.applyUnlocks(false);
          writeSave(ctx.save);
          this.toast(tr('resetDone'));
          ctx.styledOnce = false;
          this.title();
        });
      };
      $('sBack').onclick = () => {
        sfx.click();
        back();
      };
    };
    render();
  }

  // ---------- pause ----------
  pause() {
    if (ctx.mode !== 'play') return;
    ctx.paused = true;
    this.showScreen(
      `<div class="screen-center shade"><div class="panel pause-panel">
        <h2>⏸ ${esc(tr('pause'))}</h2>
        <button class="btn primary" id="pRes">▶ ${esc(tr('resume'))}</button>
        <button class="btn" id="pMap">🗺️ ${esc(tr('map'))}</button>
        <button class="btn" id="pBook">📖 ${esc(tr('book'))}</button>
        <button class="btn" id="pSet">⚙️ ${esc(tr('settings'))}</button>
        <button class="btn pink" id="pQuit">🏠 ${esc(tr('quitDay'))}</button>
      </div></div>`,
    );
    $('pRes').onclick = () => {
      sfx.click();
      this.resume();
    };
    $('pMap').onclick = () => {
      sfx.click();
      this.map(false);
    };
    $('pBook').onclick = () => {
      sfx.click();
      this.book(true);
    };
    $('pSet').onclick = () => {
      sfx.click();
      this.settings(() => this.pause());
    };
    $('pQuit').onclick = () => {
      sfx.click();
      this.confirm(tr('quitConfirm'), tr('yes'), tr('no'), () => {
        ctx.paused = false;
        ctx.day.running = false;
        ctx.fishing.stop();
        this.showScreen(null);
        this.title();
      });
    };
  }
  resume() {
    ctx.paused = false;
    this.showScreen(null);
    input.consume();
  }

  // ---------- map ----------
  map(fromHud: boolean) {
    if (ctx.mode === 'play') ctx.paused = true;
    this.showScreen(
      `<div class="screen-center shade"><div class="panel map-panel">
        <div class="panel-head"><h2>🗺️ ${esc(tr('map'))}</h2><button class="btn small" id="mBack">${esc(fromHud ? tr('resume') : tr('back'))}</button></div>
        <canvas id="mapC" width="1120" height="740"></canvas>
        <div class="legend"><span>🐱 ${esc(ctx.save.name)}</span><span>⭐ ${esc(tr('questTitle'))}</span><span>🏠 ${esc(tr('ar_rumah'))}</span><span>🛋️ Sofa</span></div>
      </div></div>`,
    );
    this.drawMap($('mapC') as HTMLCanvasElement);
    $('mBack').onclick = () => {
      sfx.click();
      if (fromHud) this.resume();
      else this.pause();
    };
  }
  drawMap(c: HTMLCanvasElement) {
    const g = c.getContext('2d')!;
    const x0 = -46, z0 = -33, x1 = 66, z1 = 41;
    const sx = c.width / (x1 - x0), sz = c.height / (z1 - z0);
    const X = (x: number) => (x - x0) * sx, Z = (z: number) => (z - z0) * sz;
    g.fillStyle = '#86cf62';
    g.fillRect(0, 0, c.width, c.height);
    for (const r of ctx.world.rects) {
      g.fillStyle = r.c;
      g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * sx, (r.z1 - r.z0) * sz);
    }
    if (!ctx.save.unlocked.pasar) {
      g.fillStyle = 'rgba(34,48,74,0.35)';
      g.fillRect(X(18), Z(5.5), 44 * sx, 33.5 * sz);
    }
    g.font = '800 34px "Baloo 2", system-ui, sans-serif';
    g.textAlign = 'center';
    g.lineWidth = 7;
    g.strokeStyle = '#22304a';
    g.fillStyle = '#fff';
    const lbl = (t: string, x: number, z: number) => {
      g.strokeText(t, X(x), Z(z));
      g.fillText(t, X(x), Z(z));
    };
    lbl(tr('ar_rumah'), -14, -20);
    lbl(tr('ar_tetangga'), 7, -20);
    lbl(tr('ar_anjing'), 30, -20);
    lbl(tr('ar_taman'), -9, 26);
    lbl(tr('ar_pasar') + (ctx.save.unlocked.pasar ? '' : ' 🔒'), 40, 28);
    lbl(tr('ar_jalan'), 20, 1);
    g.font = '44px system-ui, sans-serif';
    const icon = (t: string, x: number, z: number) => g.fillText(t, X(x), Z(z) + 15);
    icon('🛋️', ctx.world.pts.sofa.x, ctx.world.pts.sofa.z);
    icon('🐈', ctx.world.pts.lisa.x, ctx.world.pts.lisa.z);
    const tp = ctx.quests.targetPoint();
    if (tp) icon('⭐', tp.x, tp.z);
    // cat arrow
    const b = ctx.cat.body;
    g.save();
    g.translate(X(b.x), Z(b.z));
    g.rotate(-ctx.cat.yaw + Math.PI);
    g.fillStyle = '#ff6f91';
    g.strokeStyle = '#22304a';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, -30);
    g.lineTo(22, 24);
    g.lineTo(0, 12);
    g.lineTo(-22, 24);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  // ---------- summary ----------
  summary(r: { n: number; list: { icon: string; name: string }[]; coins: number; bonusDay: number; bonusTime: number; slept: boolean; perfect: boolean }) {
    this.hud(false);
    const chips = r.list.length ? r.list.map((m) => `<span class="chip">${m.icon} ${esc(m.name)}</span>`).join('') : `<span>${esc(tr('sumNone'))}</span>`;
    this.showScreen(
      `<div class="screen-center shade"><div class="panel summary-panel">
        <h2>🌇 ${esc(tr('summaryTitle', { n: r.n }))}</h2>
        <div class="stamps"><div class="stamp ${r.slept ? 'good' : 'bad'}">${r.slept ? '✓ ' + esc(tr('sumOnTime')) : '✗ ' + esc(tr('sumCaught'))}</div>${r.perfect ? `<div class="stamp good">🏆 ${esc(tr('perfectDay'))}</div>` : ''}</div>
        <div style="font-weight:800">${esc(tr('sumMischief'))} (${r.list.length})</div>
        <div class="sum-list">${chips}</div>
        <div class="sum-row"><span>${esc(tr('sumDayBonus'))}</span><span>+${r.bonusDay} 🐟</span></div>
        ${r.bonusTime ? `<div class="sum-row"><span>${esc(tr('sumOnTime'))}</span><span>+${r.bonusTime} 🐟</span></div>` : ''}
        <div class="sum-row big"><span>${esc(tr('sumCoins'))}</span><span>+${r.coins} 🐟</span></div>
        <div class="row sticky">
          <button class="btn" id="sMenu">🏠 ${esc(tr('toMenu'))}</button>
          <button class="btn" id="sStyle">🎨 ${esc(tr('style'))}</button>
          <button class="btn primary" id="sNext">▶ ${esc(tr('nextDay'))}</button>
        </div>
      </div></div>`,
    );
    $('sNext').onclick = () => {
      sfx.click();
      ctx.startDay();
    };
    $('sMenu').onclick = () => {
      sfx.click();
      this.title();
    };
    $('sStyle').onclick = () => {
      sfx.click();
      this.style(false);
    };
  }
}

export const HUD_HTML = `
<canvas id="c"></canvas>
<div id="bubbles"></div>
<div id="hud" hidden>
  <div id="joyZone"></div>
  <div id="camZone"></div>
  <div id="joyBase"><div id="joyKnob"></div></div>
  <div class="joy-hint" id="joyHint"></div>
  <div class="hud-top">
    <div class="hud-left">
      <div class="coins" id="coins"><span class="ico">🐟</span><span id="coinN">0</span></div>
      <button class="quest-card" id="questCard"><span class="face" id="questFace"></span><span id="questText"></span></button>
    </div>
    <div class="hud-center">
      <div class="daybar" id="daybar"><span class="dl" id="dayLabel"></span><div class="track"><div id="dayFill" style="position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:rgba(255,255,255,.25)"></div><div class="sun" id="daySun">☀️</div><div class="house">🏠</div></div></div>
    </div>
    <div class="hud-right">
      <button class="icon-btn" id="btnMap" aria-label="Map">🗺️</button>
      <button class="icon-btn" id="btnPause" aria-label="Pause">⏸</button>
    </div>
  </div>
  <div class="hud-buttons">
    <button id="btnAct" class="round idle"><span class="ico" id="actIco">🐾</span><span class="lbl" id="actLbl"></span></button>
    <button id="btnJump" class="round"><span class="ico">⤴</span><span class="lbl" id="jumpLbl"></span></button>
    <button id="btnMeow" class="round"><span class="ico">🐱</span><span class="lbl" id="meowLbl"></span></button>
  </div>
  <div id="fishPanel" hidden>
    <div id="fishStatus"></div>
    <div id="fishBarWrap"><div class="fishbar"><div class="zone" id="fishZone"></div><div class="mk" id="fishMk"></div></div></div>
    <button id="fishExit" aria-label="Stop">✕</button>
  </div>
</div>
<div id="toasts"></div>
<div id="hint" hidden></div>
<div id="areaTag" hidden></div>
<div id="banner" hidden></div>
<div id="bigTitle" hidden></div>
<div id="dialog" hidden><div class="face" id="dlgFace"></div><div style="flex:1;min-width:0"><div class="who" id="dlgWho"></div><div class="txt" id="dlgTxt"></div><div class="next" id="dlgNext"></div></div></div>
<div id="screen" hidden></div>
<div id="modal" hidden></div>
<div id="fade"></div>
<button id="skipBtn" class="btn small" hidden></button>
`;

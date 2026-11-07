// Foto Mode 📸: freezes the game, hides the HUD, lets the kid orbit/zoom the
// camera around the cat, pick a pose, add a frame + emoji stickers, and take
// a PNG photo (WebGL canvas + 2D overlay composited in the same frame).
import * as THREE from 'three';
import { ctx, clamp } from '../ctx';
import { tr, L } from '../i18n';
import { sfx } from '../audio';
import { newAnim, type CatAnim } from '../entities/catModel';
import { input } from '../input';

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const POSES = ['asli', 'duduk', 'tidur', 'meong', 'lompat'] as const;
export type Pose = (typeof POSES)[number];
const POSE_ICON: Record<Pose, string> = { asli: '🐈', duduk: '🐱', tidur: '😴', meong: '😺', lompat: '🦘' };
export const FRAMES = ['none', 'polaroid', 'kayu', 'hati', 'film'] as const;
export type Frame = (typeof FRAMES)[number];
const FRAME_ICON: Record<Frame, string> = { none: '⬜', polaroid: '📷', kayu: '🪵', hati: '💖', film: '🎞️' };
export const STICKERS = ['🐟', '❤️', '⭐', '👑', '🌸', '😺', '🐾', '🎀', '☀️', '🌈'];

interface Sticker {
  ch: string;
  x: number; // 0..1 of the viewport
  y: number;
  s: number; // size as a fraction of min(w, h)
  el: HTMLElement;
}

const GALLERY_KEY = 'cat-sim-photos-v1';
const GALLERY_MAX = 6;

export function loadGallery(): string[] {
  try {
    const a = JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
    return Array.isArray(a) ? a.filter((s) => typeof s === 'string').slice(0, GALLERY_MAX) : [];
  } catch (e) {
    return [];
  }
}
function storeGallery(list: string[]) {
  // drop the oldest photos until it fits (localStorage quota is small on phones)
  while (list.length) {
    try {
      localStorage.setItem(GALLERY_KEY, JSON.stringify(list));
      return;
    } catch (e) {
      list.pop();
    }
  }
  try {
    localStorage.removeItem(GALLERY_KEY);
  } catch (e) {}
}

export class PhotoMode {
  active = false;
  pose: Pose = 'asli';
  frame: Frame = 'none';
  stickers: Sticker[] = [];
  yaw = 0;
  pitch = 0.25;
  dist = 2.2;
  curDist = 2.2;
  target = new THREE.Vector3();
  anim: CatAnim = newAnim();
  meowBubble: THREE.Sprite;
  ptrs = new Map<number, { x: number; y: number }>();
  pinch0 = 0;
  dist0 = 0;
  lastCanvas: HTMLCanvasElement | null = null;
  lastURL = '';
  lastBlob: Blob | null = null;
  hidden: { el: HTMLElement; was: boolean }[] = [];
  panel: 'pose' | 'frame' | 'sticker' | null = 'pose';
  private tmp = new THREE.Vector3();

  constructor() {
    // "Meong!" speech bubble that shows in the photo (lives in the 3D scene)
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fffdf6';
    g.strokeStyle = '#22304a';
    g.lineWidth = 8;
    g.beginPath();
    g.roundRect(8, 8, 240, 86, 30);
    g.moveTo(60, 92);
    g.lineTo(48, 122);
    g.lineTo(96, 92);
    g.fill();
    g.stroke();
    g.fillStyle = '#fffdf6';
    g.fillRect(56, 84, 44, 12);
    g.fillStyle = '#22304a';
    g.font = '800 54px "Baloo 2", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(L({ id: 'Meong!', en: 'Meow!' }), 128, 54);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this.meowBubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    this.meowBubble.scale.set(0.6, 0.3, 1);
    this.meowBubble.visible = false;
    this.meowBubble.renderOrder = 6;
    ctx.scene.add(this.meowBubble);
    this.bind();
  }

  canEnter() {
    return ctx.mode === 'play' && !ctx.dialogOpen && !ctx.fishing?.active && ctx.cat.state !== 'hugged';
  }

  // ---------------- enter / exit ----------------
  enter() {
    if (this.active || !this.canEnter()) return;
    this.active = true;
    ctx.photoMode = true;
    ctx.paused = true;
    ctx.ui.showScreen(null);
    // hide HUD + floating texts, remember what was visible
    this.hidden = [];
    for (const id of ['hud', 'bubbles', 'toasts', 'hint', 'areaTag', 'banner', 'bigTitle']) {
      const el = document.getElementById(id);
      if (!el) continue;
      this.hidden.push({ el, was: el.hidden });
      el.hidden = true;
    }
    ctx.interact.marker.visible = false;
    ctx.day.arrow.visible = false;
    // start the orbit from where the play camera is
    const cam = ctx.camera as THREE.PerspectiveCamera;
    const b = ctx.cat.body;
    this.target.set(b.x, b.y + 0.35, b.z);
    const off = this.tmp.copy(cam.position).sub(this.target);
    this.dist = this.curDist = clamp(off.length(), 1.0, 5);
    this.yaw = Math.atan2(-off.x, -off.z);
    this.pitch = clamp(Math.asin(clamp(off.y / (off.length() || 1), -1, 1)), -0.1, 1.3);
    this.anim = { ...ctx.cat.anim };
    this.pose = 'asli';
    this.frame = 'none';
    this.panel = 'pose';
    this.clearStickers();
    $('photoUI').hidden = false;
    $('photoResult').hidden = true;
    this.renderUI();
    this.drawFrame();
    sfx.pop();
    ctx.ui.toast(ctx.isTouchDevice ? tr('photoHint') : tr('photoHintMouse'), 3);
    $('toasts').hidden = false;
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    ctx.photoMode = false;
    $('photoUI').hidden = true;
    $('photoResult').hidden = true;
    this.closeGallery();
    this.clearStickers();
    this.meowBubble.visible = false;
    this.freeResult();
    if (this.lastCanvas) this.lastCanvas.width = this.lastCanvas.height = 0;
    this.lastCanvas = null;
    for (const h of this.hidden) h.el.hidden = h.was;
    this.hidden = [];
    // back to play exactly as before
    ctx.cat.syncModel();
    ctx.cat.model.update(0, ctx.cat.anim);
    ctx.paused = false;
    this.ptrs.clear();
    input.consume();
    ctx.camRig.update(0.016, ctx.cat);
    sfx.click();
  }

  // ---------------- UI ----------------
  bind() {
    const touch = $('photoTouch');
    touch.addEventListener('pointerdown', (e) => {
      sfx.unlock();
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        touch.setPointerCapture(e.pointerId);
      } catch (er) {}
      if (this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.values()];
        this.pinch0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        this.dist0 = this.dist;
      }
    });
    touch.addEventListener('pointermove', (e) => {
      const p = this.ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.ptrs.size >= 2) {
        const [a, b] = [...this.ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        this.dist = clamp((this.dist0 * this.pinch0) / d, 0.8, 6);
      } else {
        this.yaw -= dx * 0.008;
        this.pitch = clamp(this.pitch + dy * 0.006, -0.15, 1.35);
      }
    });
    const up = (e: PointerEvent) => {
      this.ptrs.delete(e.pointerId);
      if (this.ptrs.size < 2) this.pinch0 = 0;
    };
    touch.addEventListener('pointerup', up);
    touch.addEventListener('pointercancel', up);
    touch.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.dist = clamp(this.dist * Math.exp(e.deltaY * 0.0015), 0.8, 6);
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        // don't let the same key open the pause menu right after
        e.stopImmediatePropagation();
        if (!$('photoGallery').hidden) this.closeGallery();
        else if (!$('photoResult').hidden) this.backToCamera();
        else this.exit();
      }
    });
    window.addEventListener('resize', () => this.active && (this.drawFrame(), this.layoutStickers()));
  }

  renderUI() {
    const bar = $('photoBar');
    const btn = (id: string, ico: string, lbl: string, on = false) => `<button class="pbtn ${on ? 'on' : ''}" data-id="${id}"><span class="pi">${ico}</span><span class="pl">${esc(lbl)}</span></button>`;
    let opts = '';
    if (this.panel === 'pose') opts = POSES.map((p) => btn('pose:' + p, POSE_ICON[p], tr('pose_' + p), this.pose === p)).join('');
    else if (this.panel === 'frame') opts = FRAMES.map((f) => btn('frame:' + f, FRAME_ICON[f], tr('frame_' + f), this.frame === f)).join('');
    else if (this.panel === 'sticker') opts = STICKERS.map((s) => `<button class="pbtn stk" data-id="stk:${s}"><span class="pi">${s}</span></button>`).join('');
    bar.innerHTML = `
      <div class="ptabs">
        ${btn('tab:pose', '🐱', tr('photoPose'), this.panel === 'pose')}
        ${btn('tab:frame', '🖼️', tr('photoFrame'), this.panel === 'frame')}
        ${btn('tab:sticker', '🎀', tr('photoSticker'), this.panel === 'sticker')}
      </div>
      <div class="popts">${opts}</div>`;
    bar.querySelectorAll('button').forEach(
      (b) =>
        ((b as HTMLElement).onclick = (e) => {
          e.stopPropagation();
          const id = (b as HTMLElement).dataset.id!;
          const [k, v] = id.split(':');
          if (k === 'tab') {
            sfx.click();
            this.panel = this.panel === v ? null : (v as any);
          } else if (k === 'pose') this.setPose(v as Pose);
          else if (k === 'frame') {
            sfx.pop();
            this.frame = v as Frame;
            this.drawFrame();
          } else if (k === 'stk') this.addSticker(id.slice(4));
          this.renderUI();
        }),
    );
    $('photoTitle').textContent = '📸 ' + tr('photoMode');
    $('photoExit').innerHTML = `✕ <span>${esc(tr('photoExit'))}</span>`;
    $('photoAlbumBtn').setAttribute('aria-label', tr('photoGallery'));
  }

  setPose(p: Pose) {
    this.pose = p;
    if (p === 'meong') sfx.meow(1.05);
    else if (p === 'lompat') sfx.jump();
    else if (p === 'tidur') sfx.purr();
    else sfx.pop();
  }

  // ---------------- stickers ----------------
  addSticker(ch: string, x = 0.3 + Math.random() * 0.4, y = 0.25 + Math.random() * 0.35) {
    if (this.stickers.length >= 12) this.removeSticker(this.stickers[0]);
    sfx.pop();
    const el = document.createElement('div');
    el.className = 'psticker';
    el.textContent = ch;
    const st: Sticker = { ch, x, y, s: 0.16, el };
    this.stickers.push(st);
    $('photoStickers').appendChild(el);
    this.layoutStickers();
    let id = -1, ox = 0, oy = 0, moved = 0;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      id = e.pointerId;
      ox = e.clientX;
      oy = e.clientY;
      moved = 0;
      el.classList.add('drag');
      try {
        el.setPointerCapture(e.pointerId);
      } catch (er) {}
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const w = window.innerWidth, h = window.innerHeight;
      st.x = clamp(st.x + (e.clientX - ox) / w, 0, 1);
      st.y = clamp(st.y + (e.clientY - oy) / h, 0, 1);
      moved += Math.abs(e.clientX - ox) + Math.abs(e.clientY - oy);
      ox = e.clientX;
      oy = e.clientY;
      this.layoutStickers();
      // drop on the trash can to remove
      const tr0 = $('photoTrash').getBoundingClientRect();
      $('photoTrash').classList.toggle('hot', e.clientX > tr0.left - 10 && e.clientX < tr0.right + 10 && e.clientY > tr0.top - 10 && e.clientY < tr0.bottom + 10);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      el.classList.remove('drag');
      const trash = $('photoTrash');
      if (trash.classList.contains('hot')) {
        trash.classList.remove('hot');
        this.removeSticker(st);
        sfx.swish();
        return;
      }
      if (moved < 8) {
        // tap: cycle size
        st.s = st.s > 0.25 ? 0.1 : st.s + 0.07;
        sfx.pop();
        this.layoutStickers();
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    $('photoTrash').hidden = false;
  }
  removeSticker(st: Sticker) {
    st.el.remove();
    this.stickers = this.stickers.filter((s) => s !== st);
    if (!this.stickers.length) $('photoTrash').hidden = true;
  }
  clearStickers() {
    for (const s of this.stickers) s.el.remove();
    this.stickers = [];
    $('photoTrash').hidden = true;
  }
  layoutStickers() {
    const w = window.innerWidth, h = window.innerHeight, m = Math.min(w, h);
    for (const s of this.stickers) {
      s.el.style.left = s.x * w + 'px';
      s.el.style.top = s.y * h + 'px';
      s.el.style.fontSize = s.s * m + 'px';
    }
  }

  // ---------------- frames (2D canvas) ----------------
  drawFrame() {
    const c = $('photoFrame') as HTMLCanvasElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(window.innerWidth * dpr);
    c.height = Math.round(window.innerHeight * dpr);
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    paintFrame(g, c.width, c.height, this.frame, ctx.save.name, ctx.day?.n ?? ctx.save.day);
  }

  // ---------------- per-frame ----------------
  update(dt: number) {
    if (!this.active) return;
    const cat = ctx.cat;
    const b = cat.body;
    // pose animation (the model only; the physics body never moves)
    const a = this.anim;
    const k = 1 - Math.exp(-10 * dt);
    const p = this.pose;
    a.speed = 0;
    a.paw = 0;
    a.scratch = a.dig = a.eat = a.hugged = false;
    a.air = p === 'lompat';
    a.sleep += ((p === 'tidur' ? 1 : p === 'asli' && cat.state === 'sleep' ? 1 : 0) - a.sleep) * k;
    a.sit += ((p === 'duduk' || p === 'meong' ? 1 : 0) - a.sit) * k;
    a.happy += ((p === 'meong' || p === 'lompat' ? 1 : 0) - a.happy) * k;
    a.earsDown += (0 - a.earsDown) * k;
    cat.model.update(dt, a);
    const root = cat.model.root;
    root.position.set(b.x, b.y + (p === 'lompat' ? 0.38 + Math.sin(ctx.time * 3) * 0.03 : 0), b.z);
    if (p === 'meong') {
      cat.model.headG.rotation.x = -0.35;
      this.meowBubble.visible = true;
      const f = cat.forward();
      this.meowBubble.position.set(b.x + f.x * 0.25, b.y + 1.05, b.z + f.z * 0.25);
    } else this.meowBubble.visible = false;
    // orbit camera with collision
    const ty = b.y + (p === 'lompat' ? 0.6 : p === 'tidur' ? 0.25 : 0.35);
    this.target.set(b.x, this.target.y + (ty - this.target.y) * k, b.z);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dx = -Math.sin(this.yaw) * cp, dy = sp, dz = -Math.cos(this.yaw) * cp;
    const hit = ctx.world.phys.raycast(this.target.x, this.target.y, this.target.z, dx, dy, dz, this.dist + 0.3, true);
    const want = Math.max(0.5, Math.min(this.dist, hit - 0.2));
    this.curDist += (want - this.curDist) * (1 - Math.exp(-12 * dt));
    if (want < this.curDist) this.curDist = want;
    const cam = ctx.camera as THREE.PerspectiveCamera;
    let py = this.target.y + dy * this.curDist;
    const px = this.target.x + dx * this.curDist, pz = this.target.z + dz * this.curDist;
    const g = ctx.world.phys.groundAt(px, pz, 0.05, py + 0.2);
    if (py < g + 0.12) py = g + 0.12;
    cam.position.set(px, py, pz);
    cam.lookAt(this.target);
  }

  // ---------------- shutter ----------------
  /** Render the scene and composite it with frame + stickers. Must run in one task (no preserveDrawingBuffer). */
  capture(): HTMLCanvasElement {
    const r = ctx.renderer as THREE.WebGLRenderer;
    this.meowBubble.visible = this.pose === 'meong';
    r.render(ctx.scene, ctx.camera);
    const src = r.domElement;
    const W = src.width, H = src.height;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const g = out.getContext('2d')!;
    g.drawImage(src, 0, 0, W, H);
    paintFrame(g, W, H, this.frame, ctx.save.name, ctx.day?.n ?? ctx.save.day);
    const m = Math.min(W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const s of this.stickers) {
      g.font = `${Math.round(s.s * m)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
      g.fillText(s.ch, s.x * W, s.y * H);
    }
    return out;
  }

  shoot() {
    if (!this.active) return;
    const out = this.capture();
    this.lastCanvas = out;
    sfx.shutter();
    const fl = $('photoFlash');
    fl.classList.remove('go');
    void fl.offsetWidth;
    fl.classList.add('go');
    this.freeResult();
    const show = (url: string) => {
      this.lastURL = url;
      $('photoResult').hidden = false;
      ($('photoImg') as HTMLImageElement).src = url;
      this.renderResult();
    };
    if (out.toBlob)
      out.toBlob((blob) => {
        if (!this.active) return;
        if (blob) {
          this.lastBlob = blob;
          show(URL.createObjectURL(blob));
        } else show(out.toDataURL('image/png'));
      }, 'image/png');
    else show(out.toDataURL('image/png'));
    this.addToGallery(out);
  }

  renderResult() {
    const canShare = this.canShareFiles();
    $('photoResBtns').innerHTML = `
      <button class="btn" id="phAgain">📸 ${esc(tr('photoAgain'))}</button>
      ${canShare ? `<button class="btn blue" id="phShare">📤 ${esc(tr('photoShare'))}</button>` : ''}
      <button class="btn primary" id="phSave">💾 ${esc(tr('photoSave'))}</button>`;
    $('photoResTitle').textContent = tr('photoTitle');
    $('phAgain').onclick = () => {
      sfx.click();
      this.backToCamera();
    };
    $('phSave').onclick = () => {
      sfx.coin();
      this.download();
    };
    const sh = document.getElementById('phShare');
    if (sh) sh.onclick = () => this.share();
  }

  backToCamera() {
    $('photoResult').hidden = true;
    this.freeResult();
  }

  freeResult() {
    if (this.lastURL.startsWith('blob:')) URL.revokeObjectURL(this.lastURL);
    this.lastURL = '';
    this.lastBlob = null;
    const img = document.getElementById('photoImg') as HTMLImageElement | null;
    if (img) img.removeAttribute('src');
  }

  fileName() {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `foto-kucing-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
  }

  download(url = this.lastURL, name = this.fileName()) {
    if (!url) return;
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      ctx.ui.toast('💾 ' + tr('photoSaved'));
    } catch (e) {}
  }

  canShareFiles() {
    const n = navigator as any;
    if (!n.share || !n.canShare) return false;
    try {
      return n.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] });
    } catch (e) {
      return false;
    }
  }

  async share(blob = this.lastBlob, name = this.fileName()) {
    if (!blob) return;
    sfx.click();
    try {
      const file = new File([blob], name, { type: blob.type || 'image/png' });
      await (navigator as any).share({ files: [file], title: tr('title1') });
    } catch (e) {
      /* cancelled */
    }
  }

  // ---------------- small gallery (last 6, downscaled JPEG) ----------------
  addToGallery(src: HTMLCanvasElement) {
    try {
      const k = Math.min(1, 640 / Math.max(src.width, src.height));
      const c = document.createElement('canvas');
      c.width = Math.round(src.width * k);
      c.height = Math.round(src.height * k);
      c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.72);
      c.width = c.height = 0;
      const list = loadGallery();
      list.unshift(url);
      storeGallery(list.slice(0, GALLERY_MAX));
    } catch (e) {}
  }

  openGallery() {
    const list = loadGallery();
    const el = $('photoGallery');
    el.innerHTML = `<div class="panel gal-panel">
        <div class="panel-head"><h2>🖼️ ${esc(tr('photoGallery'))}</h2><button class="btn small" id="galBack">${esc(tr('back'))}</button></div>
        ${list.length ? `<div class="gal-grid">${list.map((u, i) => `<button class="gal-item" data-i="${i}"><img src="${u}" alt=""></button>`).join('')}</div>` : `<p class="gal-empty">${esc(tr('photoGalleryEmpty'))}</p>`}
      </div>`;
    el.hidden = false;
    $('galBack').onclick = () => {
      sfx.click();
      this.closeGallery();
    };
    el.querySelectorAll('.gal-item').forEach(
      (b) =>
        ((b as HTMLElement).onclick = () => {
          const u = list[Number((b as HTMLElement).dataset.i)];
          sfx.click();
          this.download(u, this.fileName().replace('.png', '.jpg'));
        }),
    );
  }
  closeGallery() {
    const el = $('photoGallery');
    el.hidden = true;
    el.innerHTML = '';
  }
}

// Frame styles, drawn on a 2D canvas (both the live overlay and the final photo).
export function paintFrame(g: CanvasRenderingContext2D, W: number, H: number, frame: Frame, name: string, day: number) {
  if (frame === 'none') return;
  const m = Math.min(W, H);
  g.save();
  const font = (px: number) => `800 ${Math.round(px)}px "Baloo 2", system-ui, sans-serif`;
  if (frame === 'polaroid') {
    const t = m * 0.045, bot = m * 0.15;
    g.fillStyle = '#fffdf6';
    g.fillRect(0, 0, W, t);
    g.fillRect(0, 0, t, H);
    g.fillRect(W - t, 0, t, H);
    g.fillRect(0, H - bot, W, bot);
    g.strokeStyle = 'rgba(34,48,74,0.25)';
    g.lineWidth = Math.max(2, m * 0.004);
    g.strokeRect(t, t, W - 2 * t, H - t - bot);
    g.fillStyle = '#22304a';
    g.font = font(bot * 0.42);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(`${name} · ${L({ id: 'Hari', en: 'Day' })} ${day}`, W / 2, H - bot / 2);
    // tape
    g.fillStyle = 'rgba(255,210,63,0.75)';
    g.translate(W / 2, t * 0.5);
    g.rotate(-0.04);
    g.fillRect(-m * 0.12, -t * 0.6, m * 0.24, t * 1.3);
  } else if (frame === 'kayu') {
    const t = m * 0.06;
    const cols = ['#a8733f', '#94632f', '#b9824a'];
    for (let i = 0; i < 3; i++) {
      const o = (t / 3) * i;
      g.fillStyle = cols[i];
      g.fillRect(o, o, W - 2 * o, t / 3);
      g.fillRect(o, H - o - t / 3, W - 2 * o, t / 3);
      g.fillRect(o, o, t / 3, H - 2 * o);
      g.fillRect(W - o - t / 3, o, t / 3, H - 2 * o);
    }
    g.fillStyle = '#7a4f2a';
    const s = t * 0.5;
    for (const [x, y] of [[t / 2, t / 2], [W - t / 2, t / 2], [t / 2, H - t / 2], [W - t / 2, H - t / 2]]) g.fillRect(x - s / 2, y - s / 2, s, s);
    // little fish name plate
    const pw = m * 0.34, ph = t * 1.05;
    g.fillStyle = '#ffd23f';
    g.strokeStyle = '#7a4f2a';
    g.lineWidth = Math.max(2, m * 0.006);
    g.beginPath();
    g.roundRect(W / 2 - pw / 2, H - ph - t * 0.05, pw, ph, ph * 0.3);
    g.fill();
    g.stroke();
    g.fillStyle = '#5b3a1e';
    g.font = font(ph * 0.6);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('🐟 ' + name, W / 2, H - ph / 2 - t * 0.02);
  } else if (frame === 'hati') {
    const t = m * 0.05;
    g.fillStyle = 'rgba(255,111,145,0.85)';
    g.fillRect(0, 0, W, t);
    g.fillRect(0, H - t, W, t);
    g.fillRect(0, 0, t, H);
    g.fillRect(W - t, 0, t, H);
    const heart = (x: number, y: number, s: number, c: string) => {
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(x, y + s * 0.35);
      g.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.35);
      g.bezierCurveTo(x - s * 0.5, y + s * 0.65, x, y + s * 0.8, x, y + s);
      g.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.65, x + s * 0.5, y + s * 0.35);
      g.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35);
      g.fill();
    };
    const s = t * 0.8;
    const n = Math.max(4, Math.round(W / (s * 1.6)));
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * W;
      heart(x, t / 2 - s / 2, s, i % 2 ? '#fff' : '#ffd1dc');
      heart(x, H - t / 2 - s / 2, s, i % 2 ? '#ffd1dc' : '#fff');
    }
    const nv = Math.max(3, Math.round(H / (s * 1.6)));
    for (let i = 1; i < nv - 1; i++) {
      const y = ((i + 0.5) / nv) * H;
      heart(t / 2, y - s / 2, s, i % 2 ? '#fff' : '#ffd1dc');
      heart(W - t / 2, y - s / 2, s, i % 2 ? '#ffd1dc' : '#fff');
    }
    heart(t * 2.4, t * 1.6, t * 1.6, '#ff6f91');
    heart(W - t * 2.4, H - t * 3.2, t * 1.6, '#ff6f91');
  } else if (frame === 'film') {
    const t = m * 0.1;
    g.fillStyle = '#1d1d24';
    g.fillRect(0, 0, W, t);
    g.fillRect(0, H - t, W, t);
    g.fillStyle = '#fffdf6';
    const hw = t * 0.32, hh = t * 0.36, gap = t * 0.6;
    for (let x = gap * 0.4; x < W; x += gap) {
      g.beginPath();
      g.roundRect(x, t * 0.32, hw, hh, hw * 0.25);
      g.roundRect(x, H - t * 0.32 - hh, hw, hh, hw * 0.25);
      g.fill();
    }
    g.fillStyle = '#ffd23f';
    g.font = font(t * 0.32);
    g.textAlign = 'right';
    g.textBaseline = 'bottom';
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = t * 0.08;
    g.fillText(`🎞️ ${name} · ${String(day).padStart(2, '0')}`, W - t * 0.3, H - t - t * 0.15);
  }
  g.restore();
}

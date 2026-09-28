// Touch joystick (left), camera drag (right), buttons, and keyboard.
import { sfx } from './audio';

export const input = {
  mx: 0,
  my: 0,
  camDX: 0,
  camDY: 0,
  jump: false,
  act: false,
  meow: false,
  pause: false,
  camTouchT: -99,
  isTouch: false,
  keys: new Set<string>(),
  joyId: -1,
  joyOX: 0,
  joyOY: 0,
  joyX: 0,
  joyY: 0,
  camId: -1,
  camLX: 0,
  camLY: 0,
  moved: false,

  consume() {
    this.jump = this.act = this.meow = this.pause = false;
    this.camDX = this.camDY = 0;
  },

  update(time: number) {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (x || y) {
      const l = Math.hypot(x, y);
      x /= l;
      y /= l;
      const walk = k.has('ShiftLeft') || k.has('ShiftRight');
      if (walk) {
        x *= 0.45;
        y *= 0.45;
      }
    }
    if (this.joyId !== -1) {
      x = this.joyX;
      y = this.joyY;
    }
    this.mx = x;
    this.my = y;
    if (k.has('KeyQ')) this.camDX -= 3;
    if (k.has('KeyR')) this.camDX += 3;
    void time;
  },
};

export function setupInput(root: HTMLElement) {
  const joyZone = document.getElementById('joyZone')!;
  const camZone = document.getElementById('camZone')!;
  const base = document.getElementById('joyBase')!;
  const knob = document.getElementById('joyKnob')!;
  const R = 56;

  const startCam = (e: PointerEvent) => {
    input.camId = e.pointerId;
    input.camLX = e.clientX;
    input.camLY = e.clientY;
  };

  joyZone.addEventListener('pointerdown', (e) => {
    sfx.unlock();
    if (e.pointerType === 'mouse') {
      startCam(e);
      return;
    }
    input.isTouch = true;
    if (input.joyId !== -1) return;
    input.joyId = e.pointerId;
    input.joyOX = e.clientX;
    input.joyOY = e.clientY;
    input.joyX = input.joyY = 0;
    base.style.left = e.clientX + 'px';
    base.style.top = e.clientY + 'px';
    base.classList.add('active');
    knob.style.transform = 'translate(-50%,-50%)';
    try {
      joyZone.setPointerCapture(e.pointerId);
    } catch (er) {}
  });
  camZone.addEventListener('pointerdown', (e) => {
    sfx.unlock();
    if (e.pointerType !== 'mouse') input.isTouch = true;
    if (input.camId !== -1 && e.pointerType !== 'mouse') return;
    startCam(e);
    try {
      camZone.setPointerCapture(e.pointerId);
    } catch (er) {}
  });
  const move = (e: PointerEvent) => {
    if (e.pointerId === input.joyId) {
      let dx = e.clientX - input.joyOX, dy = e.clientY - input.joyOY;
      const l = Math.hypot(dx, dy);
      if (l > R) {
        // drag the base along so the stick never "sticks" at the edge
        input.joyOX += (dx / l) * (l - R);
        input.joyOY += (dy / l) * (l - R);
        base.style.left = input.joyOX + 'px';
        base.style.top = input.joyOY + 'px';
        dx = (dx / l) * R;
        dy = (dy / l) * R;
      }
      input.joyX = dx / R;
      input.joyY = -dy / R;
      const m = Math.hypot(input.joyX, input.joyY);
      if (m < 0.12) input.joyX = input.joyY = 0;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      input.moved = true;
    } else if (e.pointerId === input.camId) {
      input.camDX += e.clientX - input.camLX;
      input.camDY += e.clientY - input.camLY;
      input.camLX = e.clientX;
      input.camLY = e.clientY;
      input.camTouchT = performance.now() / 1000;
    }
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId === input.joyId) {
      input.joyId = -1;
      input.joyX = input.joyY = 0;
      base.classList.remove('active');
    }
    if (e.pointerId === input.camId) input.camId = -1;
  };
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  void root;

  const btn = (id: string, fn: () => void) => {
    const el = document.getElementById(id)!;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      sfx.unlock();
      if (e.pointerType !== 'mouse') input.isTouch = true;
      el.classList.add('down');
      fn();
    });
    const rel = () => el.classList.remove('down');
    el.addEventListener('pointerup', rel);
    el.addEventListener('pointerleave', rel);
    el.addEventListener('pointercancel', rel);
  };
  btn('btnJump', () => (input.jump = true));
  btn('btnAct', () => (input.act = true));
  btn('btnMeow', () => (input.meow = true));

  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    sfx.unlock();
    input.keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'Space') {
      input.jump = true;
      e.preventDefault();
    }
    if (e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'Enter') input.act = true;
    if (e.code === 'KeyM') input.meow = true;
    if (e.code === 'Escape' || e.code === 'KeyP') input.pause = true;
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.joyId = -1;
    input.camId = -1;
    input.joyX = input.joyY = 0;
    base.classList.remove('active');
  });
}

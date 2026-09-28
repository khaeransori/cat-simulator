import * as THREE from 'three';
import { ctx, clamp } from '../ctx';
import { tr, L } from '../i18n';
import { sfx } from '../audio';
import { writeSave } from '../save';
import { Human } from '../entities/npc';
import { resetProps, addCoins, MBY, dropCarried } from './mischief';
import { mbox } from '../world/builder';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export class Day {
  n = 1;
  len = 300;
  timeLeft = 300;
  doneToday = new Set<string>();
  countToday = 0;
  coinsToday = 0;
  homeMess = false;
  ended = false;
  hurry = false;
  warned = false;
  running = false;
  mama: Human;
  arrow = new THREE.Group();
  area = '';
  gateHintT = 0;
  tips: { t: number; key: string; done: boolean }[] = [];
  playT = 0;
  wasSpotted = 0;

  constructor() {
    this.mama = new Human('mama', { skin: 0xd9a877, shirt: 0x7e57c2, pants: 0x455a64, hair: 'hijab', hijabColor: 0xf06292, prop: 'tas', skirt: true, shoes: 0x5d4037 }, 'mama', ctx.world.pts.mamaStart, { x0: -30, z0: -30, x1: 30, z1: 10 }, 1.1);
    this.mama.state = 'script';
    this.mama.active = false;
    // guide arrow (chevron)
    const m = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthTest: false });
    const mo = new THREE.MeshBasicMaterial({ color: 0x22304a, transparent: true, opacity: 0.9, depthTest: false });
    const tilt = new THREE.Group();
    tilt.rotation.x = -0.75;
    for (const [mat, s, o] of [
      [mo, 1.25, 1],
      [m, 1, 2],
    ] as [THREE.Material, number, number][]) {
      const a1 = mbox(0.1 * s, 0.03, 0.42 * s, mat, 0.13, 0.015 * o, 0.1);
      a1.rotation.y = -0.75;
      const a2 = mbox(0.1 * s, 0.03, 0.42 * s, mat, -0.13, 0.015 * o, 0.1);
      a2.rotation.y = 0.75;
      a1.renderOrder = a2.renderOrder = 20 + o;
      tilt.add(a1, a2);
    }
    this.arrow.add(tilt);
    ctx.scene.add(this.arrow);
    this.arrow.visible = false;
    // the sofa: fake-sleep to end the day
    ctx.interact.add({
      id: 'sofa',
      label: 'a_sofa',
      icon: '😴',
      pos: ctx.world.pts.sofa,
      r: 1.05,
      yTol: 0.8,
      priority: 0,
      enabled: () => this.running && !ctx.cat.carrying,
      act: () => this.askSleep(),
    });
  }

  resetWorld() {
    const cat = ctx.cat;
    if (cat.carrying) dropCarried(true);
    cat.carrying = null;
    ctx.fishing.stop();
    resetProps();
    ctx.quests.applyUnlocks(false);
    for (const h of ctx.npcs as Human[]) h.reset();
    ctx.kids.reset();
    ctx.dog.reset();
    for (const f of ctx.flocks) f.reset();
    ctx.bubbles.clearAll();
    this.mama.active = false;
    this.doneToday = new Set();
    this.countToday = 0;
    this.coinsToday = 0;
    this.homeMess = false;
    this.ended = false;
    this.hurry = false;
    this.warned = false;
    this.wasSpotted = 0;
    this.len = ctx.save.settings.dayLen || 300;
    this.timeLeft = this.len;
    this.playT = 0;
    this.area = '';
    ctx.sky.set(0);
  }

  async start() {
    this.n = ctx.save.day;
    this.resetWorld();
    ctx.ui.showScreen(null);
    ctx.ui.hud(false);
    ctx.mode = 'cutscene';
    ctx.skipCut = false;
    ctx.ui.skip(true, () => (ctx.skipCut = true));
    sfx.setTrack('day');
    const W = ctx.world;
    const cat = ctx.cat;
    cat.sleepAt(W.pts.sofa, Math.PI);
    ctx.camRig.override = { pos: V(-16.2, 2.0, -18.4), look: V(-17.6, 0.7, -14.4) };
    ctx.camRig.update(0, cat, true);
    const mama = this.mama;
    mama.active = true;
    mama.state = 'script';
    mama.body.x = W.pts.mamaStart.x;
    mama.body.z = W.pts.mamaStart.z;
    mama.body.y = 0;
    mama.yaw = Math.PI;
    mama.model.setMouth('smile');
    ctx.ui.fade(false);
    await ctx.cutWait(0.6);
    if (!ctx.skipCut) {
      await mama.walkTo(V(-10.25, 0, -20.3), 2.2);
      await mama.walkTo(V(-10.25, 0, -17.6), 2.2);
      await mama.walkTo(V(-14.4, 0, -15.6), 2.2);
      mama.yaw = Math.atan2(cat.body.x - mama.body.x, cat.body.z - mama.body.z);
      mama.pose = 'wave';
    }
    if (!ctx.skipCut) await ctx.ui.dialogAsync([{ who: tr('mama'), text: tr('mamaBye', { name: ctx.save.name }), face: 'mama' }]);
    mama.pose = 'walk';
    if (!ctx.skipCut) {
      ctx.camRig.override = { pos: V(-16.8, 1.6, -16.2), look: V(-14.2, 1.1, -12.5) };
      await mama.walkTo(V(-14.2, 0, -12.6), 2.2);
      sfx.door();
      await mama.walkTo(V(-14.2, 0, -9.5), 2.2);
      mama.say({ id: tr('mamaBye2'), en: tr('mamaBye2') }, 2);
      await ctx.cutWait(0.8);
    }
    // she keeps walking away on her own
    mama.walkTo(V(-14, 0, -3.8), 2.2).then(() => mama.walkTo(V(4, 0, -2), 2.4)).then(() => (mama.active = false));
    if (ctx.skipCut) {
      mama.body.x = -14.2;
      mama.body.z = -8;
    }
    ctx.skipCut = false;
    ctx.ui.skip(false);
    await ctx.ui.dialogAsync([{ who: ctx.save.name, text: tr('doorOpen'), face: 'cat' }]);
    // go!
    ctx.camRig.override = null;
    cat.setState('free');
    cat.place(new THREE.Vector3(-14.4, 0, -16.3), 0);
    ctx.camRig.pitch = 0.3;
    ctx.camRig.snap(cat);
    ctx.ui.bigTitle(tr('dayStart', { n: this.n }));
    ctx.ui.hud(true);
    ctx.mode = 'play';
    this.running = true;
    this.setupTips();
    ctx.ui.quest();
  }

  setupTips() {
    this.tips = [];
    if (ctx.save.firstRun) {
      const touch = ctx.isTouchDevice;
      this.tips.push({ t: 1.5, key: touch ? 'tip1' : 'tip1k', done: false });
      this.tips.push({ t: 11, key: 'tip2', done: false });
      this.tips.push({ t: 22, key: 'tip4', done: false });
      this.tips.push({ t: 40, key: 'tip3', done: false });
    }
    this.tips.push({ t: this.len - 60, key: 'tip5', done: false });
  }

  askSleep() {
    ctx.ui.confirm(tr('sofaConfirm'), tr('sofaYes'), tr('sofaNo'), () => this.end(true));
  }

  zoneAt(x: number, y: number, z: number) {
    for (const zn of ctx.world.zones) if (zn.ymin !== undefined && y >= zn.ymin && x > zn.x0 && x < zn.x1 && z > zn.z0 && z < zn.z1) return zn.id;
    for (const zn of ctx.world.zones) if (zn.ymin === undefined && x > zn.x0 && x < zn.x1 && z > zn.z0 && z < zn.z1) return zn.id;
    return 'jalan';
  }

  update(dt: number) {
    const cat = ctx.cat;
    this.mama.update(dt);
    if (!this.running) {
      this.arrow.visible = false;
      return;
    }
    const active = ctx.mode === 'play' && !ctx.paused && !ctx.dialogOpen;
    if (active) {
      this.timeLeft -= dt;
      this.playT += dt;
    }
    ctx.sky.set(clamp(1 - this.timeLeft / this.len, 0, 1), dt);
    ctx.ui.timer(this.timeLeft / this.len, this.timeLeft);
    if (this.timeLeft < 45 && !this.hurry) {
      this.hurry = true;
      sfx.setTrack('hurry');
      ctx.ui.hint('⏰ ' + tr('mamaSoon'), 5);
      sfx.tone(880, 0.2, 'square', 0.1);
      sfx.tone(880, 0.2, 'square', 0.1, 0.3);
    }
    if (this.timeLeft <= 0 && active && !this.ended) {
      this.end(cat.state === 'sleep' && cat.pos.distanceTo(ctx.world.pts.sofa) < 0.8);
      return;
    }
    // tips
    for (const tp of this.tips)
      if (!tp.done && this.playT > tp.t && active) {
        tp.done = true;
        ctx.ui.hint(tr(tp.key), 6);
      }
    // area banner
    const b = cat.body;
    const a = this.zoneAt(b.x, b.y, b.z);
    if (a !== this.area) {
      if (this.area) ctx.ui.area(tr('ar_' + a));
      this.area = a;
    }
    // locked market gate hint
    this.gateHintT -= dt;
    if (!ctx.save.unlocked.pasar && this.gateHintT < 0 && Math.hypot(b.x - ctx.world.pts.pasarGate.x, b.z - ctx.world.pts.pasarGate.z) < 3) {
      this.gateHintT = 8;
      ctx.ui.toast('🔒 ' + tr('lockedGate'));
    }
    // guide arrow
    let target: THREE.Vector3 | null = null;
    if (this.timeLeft < 45) target = ctx.world.pts.sofa;
    else if (ctx.save.settings.arrow) target = ctx.quests.targetPoint();
    const show = !!target && active && (cat.state === 'free' || cat.state === 'act') && Math.hypot(target.x - b.x, target.z - b.z) > 3;
    this.arrow.visible = show;
    if (show) {
      const ang = Math.atan2(target!.x - b.x, target!.z - b.z);
      this.arrow.position.set(b.x + Math.sin(ang) * 0.9, b.y + 1.0 + Math.sin(ctx.time * 4) * 0.06, b.z + Math.cos(ang) * 0.9);
      this.arrow.rotation.y = ang;
      const pulse = this.timeLeft < 45 ? 1.3 + Math.sin(ctx.time * 10) * 0.15 : 1;
      this.arrow.scale.set(pulse, pulse, pulse);
    }
  }

  async end(slept: boolean) {
    if (this.ended) return;
    this.ended = true;
    this.running = false;
    const cat = ctx.cat;
    const W = ctx.world;
    const mama = this.mama;
    ctx.fishing.stop();
    if (cat.carrying) dropCarried(true);
    ctx.mode = 'cutscene';
    ctx.ui.hud(false);
    ctx.ui.hideModals();
    this.arrow.visible = false;
    sfx.setTrack('menu');
    const early = this.timeLeft > 1;
    await ctx.ui.fadeAsync(true);
    ctx.sky.set(1);
    mama.active = true;
    mama.state = 'script';
    mama.goal = null;
    mama.body.y = 0;
    if (slept) {
      cat.sleepAt(W.pts.sofa, Math.PI);
      mama.body.x = -14.2;
      mama.body.z = -11.2;
      mama.yaw = Math.PI;
      ctx.camRig.override = { pos: V(-16.2, 2.0, -18.4), look: V(-17.2, 0.7, -14.2) };
      ctx.camRig.update(0, cat, true);
      if (early) {
        await ctx.ui.fadeAsync(true, tr('hoursLater'));
        await ctx.cutWait(1.0, true);
      }
      await ctx.ui.fadeAsync(false);
      sfx.door();
      await mama.walkTo(V(-14.2, 0, -14.4), 2);
      await mama.walkTo(V(-16.2, 0, -15.6), 2);
      mama.yaw = Math.atan2(cat.body.x - mama.body.x, cat.body.z - mama.body.z);
      mama.pose = 'laugh';
      mama.model.setMouth('grin');
      ctx.fx.hearts(mama.body.x, 2.5, mama.body.z, 3);
      await ctx.ui.dialogAsync([{ who: tr('mama'), text: tr('mamaHome1', { name: ctx.save.name }), face: 'mama' }]);
      if (this.homeMess) {
        mama.model.setMouth('o');
        mama.pose = 'idle';
        await ctx.ui.dialogAsync([
          { who: tr('mama'), text: tr('mamaMess'), face: 'mama' },
          { who: ctx.save.name, text: tr('catInnocent'), face: 'cat' },
        ]);
      }
    } else {
      // caught outside
      cat.setState('cut');
      cat.place(V(-14, 0.15, -3.2), 0);
      mama.body.x = -14;
      mama.body.z = -1.8;
      mama.yaw = Math.PI;
      mama.pose = 'point';
      mama.model.setMouth('frown');
      ctx.catEarsDown = true;
      ctx.catSit = true;
      ctx.camRig.override = { pos: V(-11.4, 1.8, -5.2), look: V(-14, 0.9, -2.6) };
      ctx.camRig.update(0, cat, true);
      await ctx.ui.fadeAsync(false);
      sfx.meow(0.8);
      await ctx.ui.dialogAsync([
        { who: tr('mama'), text: tr('mamaCaught', { name: ctx.save.name }), face: 'mama' },
        { who: ctx.save.name, text: tr('catSorry'), face: 'cat' },
      ]);
      ctx.catEarsDown = false;
      ctx.catSit = false;
    }
    // results
    const perfect = ctx.quests.onDayEnd(slept);
    const s = ctx.save;
    const bonusDay = 5;
    const bonusTime = slept ? 10 : 0;
    addCoins(bonusDay + bonusTime);
    if (slept) s.stats.onTime++;
    else s.stats.caught++;
    s.day++;
    s.firstRun = false;
    writeSave(s);
    const list = [...this.doneToday].map((id) => MBY[id]).filter(Boolean);
    ctx.mode = 'summary';
    ctx.ui.summary({
      n: this.n,
      list: list.map((m) => ({ icon: m.icon, name: L(m.name) })),
      coins: this.coinsToday,
      bonusDay,
      bonusTime,
      slept,
      perfect,
    });
  }
}

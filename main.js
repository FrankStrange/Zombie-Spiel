/* Zombie Loot Alpha
 * Controls:
 *  - WASD: move
 *  - Mouse: aim
 *  - Left click: shoot
 *  - E: loot crate (when near)
 * Tip: Run via a local server (see README).
 */

const CONFIG = {
  world: { w: 2400, h: 1800 },
  player: { speed: 220, maxHp: 100 },
  gun: { fireRateMs: 140, bulletSpeed: 720, damage: 25, magSize: 18, reloadMs: 950 },
  zombie: { speed: 115, hp: 60, damage: 12, hitCooldownMs: 650 },
  spawn: { initial: 10, max: 24, everyMs: 1200 },
  loot: { crates: 14, radius: 44 }
};

class MainScene extends Phaser.Scene {
  constructor() { super('main'); }

  preload() {
    // No external assets needed for alpha (we draw with Graphics/textures).
  }

  create() {
    // --- World background (simple tiled grid)
    this.cameras.main.setBackgroundColor('#0b0f14');

    // Generate tiny textures for player/zombie/bullet/crate
    this._makeTextures();

    // World bounds
    this.physics.world.setBounds(0, 0, CONFIG.world.w, CONFIG.world.h);

    // Groups
    this.walls = this.physics.add.staticGroup();
    this.crates = this.physics.add.staticGroup();
    this.bullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, runChildUpdate: true, maxSize: 80 });
    this.zombies = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, runChildUpdate: true });

    // Map: a few "houses" (static rectangles)
    this._buildHouses();

    // Player
    this.player = this.physics.add.sprite(280, 260, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setCircle(14);
    this.player.hp = CONFIG.player.maxHp;
    this.player.ammo = CONFIG.gun.magSize;
    this.player.reserve = 90;
    this.player.reloading = false;
    this.player.lastShot = 0;

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBounds(0, 0, CONFIG.world.w, CONFIG.world.h);

    // Collisions
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.zombies, this.walls);
    this.physics.add.collider(this.bullets, this.walls, (b) => b.destroy());

    // Bullet -> zombie overlap
    this.physics.add.overlap(this.bullets, this.zombies, this._onBulletHitZombie, null, this);

    // Zombie -> player overlap (with cooldown)
    this.physics.add.overlap(this.zombies, this.player, this._onZombieTouchPlayer, null, this);

    // Loot crates
    this._spawnCrates();
    this.physics.add.collider(this.crates, this.walls);

    // Input
    this.keys = this.input.keyboard.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D',
      loot: 'E', reload: 'R'
    });
    this.input.on('pointerdown', (pointer) => {
      if (pointer.leftButtonDown()) this._tryShoot();
    });

    // UI
    this.ui = {
      topLeft: this.add.text(16, 16, '', { fontSize: '16px', color: '#e2e8f0' }).setScrollFactor(0),
      hint: this.add.text(16, 40, 'WASD bewegen • Maus zielen • Klick schießen • E looten • R reload', {
        fontSize: '13px', color: '#94a3b8'
      }).setScrollFactor(0)
    };

    // Game state
    this.score = 0;
    this.lastSpawn = 0;

    // Spawn some zombies now
    for (let i = 0; i < CONFIG.spawn.initial; i++) this._spawnZombie();

    // Small ambience grid
    this._drawGrid();

    // Restart
    this.gameOver = false;
    this.input.keyboard.on('keydown-ENTER', () => {
      if (this.gameOver) this.scene.restart();
    });
  }

  update(time, delta) {
    if (this.gameOver) return;

    // Movement
    const vx = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
    const vy = (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0);
    const v = new Phaser.Math.Vector2(vx, vy).normalize().scale(CONFIG.player.speed);
    this.player.setVelocity(v.x, v.y);

    // Aim indicator (rotate player slightly)
    const p = this.input.activePointer.positionToCamera(this.cameras.main);
    const ang = Phaser.Math.Angle.Between(this.player.x, this.player.y, p.x, p.y);
    this.player.setRotation(ang);

    // Shooting (hold-to-fire feel)
    if (this.input.activePointer.isDown) this._tryShoot();

    // Reload
    if (Phaser.Input.Keyboard.JustDown(this.keys.reload)) this._reload();

    // Loot
    if (Phaser.Input.Keyboard.JustDown(this.keys.loot)) this._tryLoot();

    // Zombies follow
    this.zombies.children.iterate((z) => {
      if (!z || !z.active) return;
      const za = Phaser.Math.Angle.Between(z.x, z.y, this.player.x, this.player.y);
      this.physics.velocityFromRotation(za, CONFIG.zombie.speed, z.body.velocity);
      z.setRotation(za);
    });

    // Spawn pacing
    if (time - this.lastSpawn > CONFIG.spawn.everyMs && this.zombies.countActive(true) < CONFIG.spawn.max) {
      this.lastSpawn = time;
      this._spawnZombie();
    }

    // UI
    this.ui.topLeft.setText([
      `HP: ${Math.max(0, Math.floor(this.player.hp))}/${CONFIG.player.maxHp}`,
      `Ammo: ${this.player.ammo}/${this.player.reserve} ${this.player.reloading ? '(reloading...)' : ''}`,
      `Kills: ${this.score}`,
      `Zombies: ${this.zombies.countActive(true)}`
    ]);

    if (this.player.hp <= 0) this._doGameOver();
  }

  // --- Helpers

  _makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Player (cyan circle with small nose)
    g.clear();
    g.fillStyle(0x22d3ee, 1); g.fillCircle(16, 16, 14);
    g.fillStyle(0x0b0f14, 1); g.fillCircle(24, 16, 3);
    g.generateTexture('player', 32, 32);

    // Zombie (green-ish)
    g.clear();
    g.fillStyle(0x34d399, 1); g.fillCircle(16, 16, 14);
    g.fillStyle(0x052e1b, 1); g.fillCircle(24, 16, 3);
    g.generateTexture('zombie', 32, 32);

    // Bullet (small)
    g.clear();
    g.fillStyle(0xf8fafc, 1); g.fillCircle(6, 6, 4);
    g.generateTexture('bullet', 12, 12);

    // Crate
    g.clear();
    g.fillStyle(0x8b5a2b, 1); g.fillRect(0, 0, 26, 26);
    g.lineStyle(2, 0x2a1a0a, 1); g.strokeRect(1, 1, 24, 24);
    g.generateTexture('crate', 26, 26);

    // Wall block
    g.clear();
    g.fillStyle(0x1f2937, 1); g.fillRect(0, 0, 48, 48);
    g.lineStyle(2, 0x0f172a, 1); g.strokeRect(1, 1, 46, 46);
    g.generateTexture('wall', 48, 48);

    g.destroy();
  }

  _drawGrid() {
    const grid = this.add.graphics();
    grid.setDepth(-10);
    grid.lineStyle(1, 0x111827, 1);
    const step = 64;
    for (let x = 0; x <= CONFIG.world.w; x += step) {
      grid.beginPath(); grid.moveTo(x, 0); grid.lineTo(x, CONFIG.world.h); grid.strokePath();
    }
    for (let y = 0; y <= CONFIG.world.h; y += step) {
      grid.beginPath(); grid.moveTo(0, y); grid.lineTo(CONFIG.world.w, y); grid.strokePath();
    }
  }

  _buildHouses() {
    // Simple house rectangles: walls around a rectangle with a door gap.
    const houses = [
      { x: 420, y: 360, w: 520, h: 360, door: 'south' },
      { x: 1250, y: 260, w: 520, h: 420, door: 'east' },
      { x: 980, y: 980, w: 620, h: 420, door: 'west' },
      { x: 250, y: 1050, w: 520, h: 420, door: 'north' },
      { x: 1750, y: 980, w: 520, h: 420, door: 'south' },
    ];

    const block = 48;
    for (const h of houses) {
      // Outline blocks
      const left = Math.floor(h.x / block) * block;
      const top = Math.floor(h.y / block) * block;
      const right = Math.floor((h.x + h.w) / block) * block;
      const bottom = Math.floor((h.y + h.h) / block) * block;

      // Door gap length (2 blocks)
      const gap = block * 2;

      for (let x = left; x <= right; x += block) {
        // top wall
        this._placeWall(x, top);
        // bottom wall with door gap
        const doorX0 = left + Math.floor((right - left - gap) / 2);
        const inDoorGap = (h.door === 'south') && (x >= doorX0 && x <= doorX0 + gap);
        if (!inDoorGap) this._placeWall(x, bottom);
      }

      for (let y = top; y <= bottom; y += block) {
        this._placeWall(left, y);
        this._placeWall(right, y);
      }

      // Door openings for other sides (erase by skipping placement along one side)
      // For simplicity, we add extra “fences” inside to suggest rooms:
      this._placeWall(left + block*2, top + block*2);
      this._placeWall(left + block*3, top + block*2);
      this._placeWall(left + block*2, top + block*3);
    }

    // Border clutter
    for (let i = 0; i < 26; i++) {
      const x = Phaser.Math.Between(80, CONFIG.world.w - 80);
      const y = Phaser.Math.Between(80, CONFIG.world.h - 80);
      if (Phaser.Math.Distance.Between(x, y, 280, 260) < 180) continue;
      if (Math.random() < 0.55) this._placeWall(Math.floor(x/48)*48, Math.floor(y/48)*48);
    }
  }

  _placeWall(x, y) {
    const w = this.walls.create(x + 24, y + 24, 'wall'); // centered
    w.refreshBody();
    return w;
  }

  _spawnCrates() {
    let placed = 0;
    while (placed < CONFIG.loot.crates) {
      const x = Phaser.Math.Between(120, CONFIG.world.w - 120);
      const y = Phaser.Math.Between(120, CONFIG.world.h - 120);

      // Avoid spawn area
      if (Phaser.Math.Distance.Between(x, y, this.player?.x ?? 280, this.player?.y ?? 260) < 260) continue;

      // Avoid walls close by (cheap check)
      const wallNear = this.walls.children.iterate((w) => {
        if (!w) return false;
        return Phaser.Math.Distance.Between(x, y, w.x, w.y) < 70;
      });
      if (wallNear) continue;

      const c = this.crates.create(x, y, 'crate');
      c.setData('opened', false);
      c.setData('loot', this._rollLoot());
      c.refreshBody();

      placed++;
    }
  }

  _rollLoot() {
    // Simple loot table
    const r = Math.random();
    if (r < 0.55) return { ammo: Phaser.Math.Between(8, 18), med: 0 };
    if (r < 0.85) return { ammo: Phaser.Math.Between(6, 14), med: 1 };
    return { ammo: Phaser.Math.Between(12, 24), med: 2 };
  }

  _tryLoot() {
    let nearest = null;
    let bestD = 1e9;
    this.crates.children.iterate((c) => {
      if (!c || !c.active) return;
      if (c.getData('opened')) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y);
      if (d < bestD) { bestD = d; nearest = c; }
    });

    if (!nearest || bestD > CONFIG.loot.radius) return;

    // Open crate
    nearest.setData('opened', true);
    nearest.setTint(0x3f3f46);
    const loot = nearest.getData('loot');

    // Apply loot
    this.player.reserve += loot.ammo;
    if (loot.med > 0) {
      this.player.hp = Math.min(CONFIG.player.maxHp, this.player.hp + loot.med * 18);
    }

    // Floating text
    const msg = `+${loot.ammo} ammo${loot.med ? `, +${loot.med*18} hp` : ''}`;
    const t = this.add.text(nearest.x, nearest.y - 26, msg, { fontSize: '13px', color: '#e2e8f0' }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: t.y - 24, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  _tryShoot() {
    const now = this.time.now;
    if (now - this.player.lastShot < CONFIG.gun.fireRateMs) return;
    if (this.player.reloading) return;

    if (this.player.ammo <= 0) {
      this._reload();
      return;
    }

    this.player.lastShot = now;
    this.player.ammo--;

    const pointer = this.input.activePointer.positionToCamera(this.cameras.main);
    const ang = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.x, pointer.y);

    const b = this.bullets.get();
    if (!b) return;

    b.enableBody(true, this.player.x, this.player.y, true, true);
    b.setTexture('bullet');
    b.setCircle(5);
    b.setRotation(ang);

    const spread = Phaser.Math.FloatBetween(-0.06, 0.06);
    const a2 = ang + spread;
    this.physics.velocityFromRotation(a2, CONFIG.gun.bulletSpeed, b.body.velocity);

    // Bullet lifetime
    b.lifetime = 800;
    b.update = (time, delta) => {
      b.lifetime -= delta;
      if (b.lifetime <= 0) b.destroy();
    };
  }

  _reload() {
    if (this.player.reloading) return;
    if (this.player.ammo >= CONFIG.gun.magSize) return;
    if (this.player.reserve <= 0) return;

    this.player.reloading = true;
    this.time.delayedCall(CONFIG.gun.reloadMs, () => {
      const need = CONFIG.gun.magSize - this.player.ammo;
      const take = Math.min(need, this.player.reserve);
      this.player.reserve -= take;
      this.player.ammo += take;
      this.player.reloading = false;
    });
  }

  _spawnZombie() {
    // Spawn at edges away from player
    const edge = Phaser.Math.Between(0, 3);
    let x, y;
    if (edge === 0) { x = 30; y = Phaser.Math.Between(30, CONFIG.world.h - 30); }
    if (edge === 1) { x = CONFIG.world.w - 30; y = Phaser.Math.Between(30, CONFIG.world.h - 30); }
    if (edge === 2) { x = Phaser.Math.Between(30, CONFIG.world.w - 30); y = 30; }
    if (edge === 3) { x = Phaser.Math.Between(30, CONFIG.world.w - 30); y = CONFIG.world.h - 30; }

    if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 520) return;

    const z = this.zombies.create(x, y, 'zombie');
    z.setCircle(14);
    z.hp = CONFIG.zombie.hp;
    z.lastHitAt = 0;
    z.setCollideWorldBounds(true);
    return z;
  }

  _onBulletHitZombie(bullet, zombie) {
    if (!bullet.active || !zombie.active) return;
    bullet.destroy();

    zombie.hp -= CONFIG.gun.damage;
    zombie.setTintFill(0xffffff);
    this.time.delayedCall(80, () => zombie.clearTint());

    if (zombie.hp <= 0) {
      zombie.destroy();
      this.score++;

      // Small chance to drop ammo pickup (adds to reserve instantly)
      if (Math.random() < 0.25) {
        this.player.reserve += Phaser.Math.Between(4, 10);
      }
    }
  }

  _onZombieTouchPlayer(zombie, player) {
    const now = this.time.now;
    if (now - zombie.lastHitAt < CONFIG.zombie.hitCooldownMs) return;
    zombie.lastHitAt = now;

    player.hp -= CONFIG.zombie.damage;

    // Screen shake
    this.cameras.main.shake(90, 0.006);
  }

  _doGameOver() {
    this.gameOver = true;
    this.player.setVelocity(0, 0);

    // Stop zombies
    this.zombies.children.iterate((z) => z && z.body && z.body.setVelocity(0, 0));

    const cx = this.cameras.main.midPoint.x;
    const cy = this.cameras.main.midPoint.y;

    const panel = this.add.rectangle(cx, cy, 520, 220, 0x000000, 0.65).setScrollFactor(0);
    const t1 = this.add.text(cx, cy - 40, 'GAME OVER', { fontSize: '34px', color: '#f8fafc' }).setOrigin(0.5).setScrollFactor(0);
    const t2 = this.add.text(cx, cy + 4, `Kills: ${this.score}\nENTER zum Neustart`, { fontSize: '18px', color: '#cbd5e1', align: 'center' })
      .setOrigin(0.5).setScrollFactor(0);

    // Bring UI above
    panel.setDepth(1000); t1.setDepth(1001); t2.setDepth(1001);
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#0b0f14',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: [MainScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});

/* Zombie Loot Alpha – Top-Down (Phaser 3)
   Controls:
   - WASD: move
   - Mouse: aim
   - LMB (hold): shoot
   - R: reload
   - E: loot crate (nearby)
   - ENTER: restart on game over
*/

console.log("main.js läuft ✅");

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const STATE = {
  hp: 100,
  ammo: 12,
  ammoMax: 12,
  reserve: 48,
  score: 0,
  gameOver: false,
};

const WORLD = {
  w: 2200,
  h: 2200,
};

class MainScene extends Phaser.Scene {
  constructor() {
    super("main");
  }

  create() {
    // --- reset state ---
    STATE.hp = 100;
    STATE.ammo = 12;
    STATE.ammoMax = 12;
    STATE.reserve = 48;
    STATE.score = 0;
    STATE.gameOver = false;

    // --- background ---
    this.cameras.main.setBackgroundColor("#0b0f12");

    // Simple ground grid
    const g = this.add.graphics();
    g.lineStyle(1, 0x1b2a33, 0.25);
    for (let x = 0; x <= WORLD.w; x += 50) g.lineBetween(x, 0, x, WORLD.h);
    for (let y = 0; y <= WORLD.h; y += 50) g.lineBetween(0, y, WORLD.w, y);
    g.setDepth(-10);

    // --- physics world bounds ---
    this.physics.world.setBounds(0, 0, WORLD.w, WORLD.h);

    // --- player ---
    this.player = this.add.rectangle(WORLD.w / 2, WORLD.h / 2, 22, 22, 0x9be15d);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.playerSpeed = 260;

    // --- aim indicator ---
    this.aimLine = this.add.graphics();

    // --- groups ---
    this.bullets = this.physics.add.group({ classType: Phaser.GameObjects.Rectangle, runChildUpdate: true });
    this.zombies = this.physics.add.group();
    this.crates = this.physics.add.staticGroup();

    // --- obstacles / houses (simple rectangles) ---
    this.walls = this.physics.add.staticGroup();
    this._spawnHouses();

    // --- loot crates ---
    this._spawnCrates(18);

    // --- zombies ---
    this.spawnTimer = 0;
    this.spawnInterval = 1100; // ms
    this.maxZombies = 18;

    // --- input ---
    this.keys = this.input.keyboard.addKeys("W,A,S,D,E,R,ENTER");
    this.input.mouse.disableContextMenu();

    this.isFiring = false;
    this.lastShotAt = 0;
    this.fireRateMs = 120;

    this.input.on("pointerdown", (p) => {
      if (STATE.gameOver) return;
      if (p.leftButtonDown()) this.isFiring = true;
    });

    this.input.on("pointerup", () => {
      this.isFiring = false;
    });

    // --- collisions ---
    this.physics.add.collider(this.player, this.walls);

    this.physics.add.collider(this.zombies, this.walls);
    this.physics.add.collider(this.zombies, this.zombies);

    // bullet hits zombie
    this.physics.add.overlap(this.bullets, this.zombies, (bullet, zombie) => {
      if (!bullet.active || !zombie.active) return;
      bullet.destroy();

      zombie.hp -= 25;
      if (zombie.hp <= 0) {
        zombie.destroy();
        STATE.score += 10;
      }
    });

    // zombie hits player
    this.physics.add.overlap(this.player, this.zombies, () => {
      if (STATE.gameOver) return;
      // damage with cooldown
      const now = this.time.now;
      if (!this.lastHitAt || now - this.lastHitAt > 450) {
        this.lastHitAt = now;
        STATE.hp = clamp(STATE.hp - 10, 0, 100);
        if (STATE.hp <= 0) this._setGameOver();
      }
    });

    // --- camera ---
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBounds(0, 0, WORLD.w, WORLD.h);

    // --- UI ---
    this.ui = this.add.text(12, 12, "", {
      fontFamily: "system-ui, Segoe UI, Arial",
      fontSize: "16px",
      color: "#e8f0ff",
    });
    this.ui.setScrollFactor(0).setDepth(1000);

    this.hint = this.add.text(12, 38, "", {
      fontFamily: "system-ui, Segoe UI, Arial",
      fontSize: "14px",
      color: "#b6c6d6",
    });
    this.hint.setScrollFactor(0).setDepth(1000);

    this.gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 2, "", {
      fontFamily: "system-ui, Segoe UI, Arial",
      fontSize: "36px",
      color: "#ffffff",
      align: "center",
    });
    this.gameOverText.setOrigin(0.5).setScrollFactor(0).setDepth(2000);

    // resize handling
    this.scale.on("resize", () => {
      if (STATE.gameOver) {
        this.gameOverText.setPosition(this.scale.width / 2, this.scale.height / 2);
      }
    });

    this._updateUI();
  }

  update(time, delta) {
    // restart
    if (STATE.gameOver) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER)) this.scene.restart();
      return;
    }

    // movement
    let vx = 0, vy = 0;
    if (this.keys.A.isDown) vx -= 1;
    if (this.keys.D.isDown) vx += 1;
    if (this.keys.W.isDown) vy -= 1;
    if (this.keys.S.isDown) vy += 1;

    const len = Math.hypot(vx, vy) || 1;
    vx = (vx / len) * this.playerSpeed;
    vy = (vy / len) * this.playerSpeed;

    this.player.body.setVelocity(vx, vy);

    // aim line
    const pointer = this.input.activePointer;
    const wx = pointer.worldX;
    const wy = pointer.worldY;
    this.aimLine.clear();
    this.aimLine.lineStyle(2, 0xffffff, 0.3);
    this.aimLine.lineBetween(this.player.x, this.player.y, wx, wy);

    // shooting
    if (this.isFiring && time - this.lastShotAt >= this.fireRateMs) {
      this.lastShotAt = time;
      this._tryShoot(wx, wy);
    }

    // reload
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this._reload();

    // loot
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this._tryLoot();

    // zombie spawning
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      if (this.zombies.countActive(true) < this.maxZombies) this._spawnZombie();
    }

    // zombie AI move toward player
    this.zombies.children.iterate((z) => {
      if (!z || !z.active) return;
      const dx = this.player.x - z.x;
      const dy = this.player.y - z.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = z.speed;
      z.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
    });

    this._updateUI();
  }

  _spawnHouses() {
    // Simple “houses” as static wall blocks with gaps
    const blocks = [
      { x: 420, y: 420, w: 260, h: 180 },
      { x: 980, y: 360, w: 320, h: 220 },
      { x: 1650, y: 520, w: 260, h: 260 },
      { x: 520, y: 1280, w: 360, h: 220 },
      { x: 1200, y: 1320, w: 260, h: 320 },
      { x: 1760, y: 1420, w: 320, h: 220 },
    ];

    const wallThickness = 18;

    for (const b of blocks) {
      // Create 4 walls around a rectangle, with a "door gap" on one side
      const doorSide = Phaser.Math.Between(0, 3);
      const doorSize = 64;

      // top
      this._addWallSegment(b.x, b.y - b.h / 2, b.w, wallThickness, doorSide === 0 ? doorSize : 0);
      // bottom
      this._addWallSegment(b.x, b.y + b.h / 2, b.w, wallThickness, doorSide === 1 ? doorSize : 0);
      // left
      this._addWallSegment(b.x - b.w / 2, b.y, wallThickness, b.h, doorSide === 2 ? doorSize : 0);
      // right
      this._addWallSegment(b.x + b.w / 2, b.y, wallThickness, b.h, doorSide === 3 ? doorSize : 0);
    }
  }

  _addWallSegment(cx, cy, w, h, doorGap) {
    // If doorGap > 0, split wall into two segments with a gap in the middle
    if (!doorGap) {
      const r = this.add.rectangle(cx, cy, w, h, 0x2b3a44);
      this.physics.add.existing(r, true);
      this.walls.add(r);
      return;
    }

    if (w > h) {
      // horizontal split
      const leftW = (w - doorGap) / 2;
      const rightW = leftW;
      const offset = (doorGap + leftW) / 2;

      const r1 = this.add.rectangle(cx - offset, cy, leftW, h, 0x2b3a44);
      const r2 = this.add.rectangle(cx + offset, cy, rightW, h, 0x2b3a44);
      this.physics.add.existing(r1, true);
      this.physics.add.existing(r2, true);
      this.walls.add(r1);
      this.walls.add(r2);
    } else {
      // vertical split
      const topH = (h - doorGap) / 2;
      const botH = topH;
      const offset = (doorGap + topH) / 2;

      const r1 = this.add.rectangle(cx, cy - offset, w, topH, 0x2b3a44);
      const r2 = this.add.rectangle(cx, cy + offset, w, botH, 0x2b3a44);
      this.physics.add.existing(r1, true);
      this.physics.add.existing(r2, true);
      this.walls.add(r1);
      this.walls.add(r2);
    }
  }

  _spawnCrates(n) {
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Between(100, WORLD.w - 100);
      const y = Phaser.Math.Between(100, WORLD.h - 100);

      const crate = this.add.rectangle(x, y, 18, 18, 0xd7a34a);
      this.physics.add.existing(crate, true);
      crate.isCrate = true;
      crate.looted = false;
      this.crates.add(crate);
    }
  }

  _spawnZombie() {
    // spawn at edge around camera/player
    const pad = 500;
    const side = Phaser.Math.Between(0, 3);
    let x, y;

    if (side === 0) { // top
      x = clamp(this.player.x + Phaser.Math.Between(-pad, pad), 0, WORLD.w);
      y = clamp(this.player.y - pad, 0, WORLD.h);
    } else if (side === 1) { // bottom
      x = clamp(this.player.x + Phaser.Math.Between(-pad, pad), 0, WORLD.w);
      y = clamp(this.player.y + pad, 0, WORLD.h);
    } else if (side === 2) { // left
      x = clamp(this.player.x - pad, 0, WORLD.w);
      y = clamp(this.player.y + Phaser.Math.Between(-pad, pad), 0, WORLD.h);
    } else { // right
      x = clamp(this.player.x + pad, 0, WORLD.w);
      y = clamp(this.player.y + Phaser.Math.Between(-pad, pad), 0, WORLD.h);
    }

    const z = this.add.rectangle(x, y, 22, 22, 0xe35d5b);
    this.physics.add.existing(z);
    z.body.setCollideWorldBounds(true);

    z.hp = 50;
    z.speed = Phaser.Math.Between(90, 140);

    this.zombies.add(z);
  }

  _tryShoot(wx, wy) {
    if (STATE.ammo <= 0) return;

    STATE.ammo--;

    const b = this.add.rectangle(this.player.x, this.player.y, 6, 3, 0xffffff);
    this.physics.add.existing(b);
    b.body.setAllowGravity(false);

    // direction
    const dx = wx - this.player.x;
    const dy = wy - this.player.y;
    const dist = Math.hypot(dx, dy) || 1;

    const speed = 800;
    b.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);

    // rotate visual roughly (optional)
    b.rotation = Math.atan2(dy, dx);

    // lifetime
    this.time.delayedCall(900, () => {
      if (b && b.active) b.destroy();
    });

    // collide with walls => destroy
    this.physics.add.collider(b, this.walls, () => {
      if (b && b.active) b.destroy();
    });

    this.bullets.add(b);
  }

  _reload() {
    if (STATE.ammo >= STATE.ammoMax) return;
    if (STATE.reserve <= 0) return;

    const need = STATE.ammoMax - STATE.ammo;
    const take = Math.min(need, STATE.reserve);
    STATE.reserve -= take;
    STATE.ammo += take;
  }

  _tryLoot() {
    // find nearest unlooted crate within range
    let best = null;
    let bestD = 999999;

    this.crates.children.iterate((c) => {
      if (!c || !c.active || c.looted) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y);
      if (d < 55 && d < bestD) {
        bestD = d;
        best = c;
      }
    });

    if (!best) return;

    best.looted = true;
    best.fillColor = 0x6b6b6b;

    // loot roll
    const roll = Phaser.Math.Between(1, 100);
    if (roll <= 45) {
      // ammo
      const add = Phaser.Math.Between(8, 20);
      STATE.reserve += add;
      this._flashHint(`Loot: +${add} Ammo`);
    } else if (roll <= 75) {
      // medkit
      const heal = Phaser.Math.Between(15, 35);
      STATE.hp = clamp(STATE.hp + heal, 0, 100);
      this._flashHint(`Loot: +${heal} HP`);
    } else {
      // weapon upgrade (fire rate)
      this.fireRateMs = Math.max(70, this.fireRateMs - 10);
      this._flashHint(`Loot: Fire rate ↑`);
    }

    STATE.score += 2;
  }

  _flashHint(msg) {
    this.hint.setText(msg);
    this.time.delayedCall(1200, () => {
      if (!STATE.gameOver) this.hint.setText("");
    });
  }

  _updateUI() {
    this.ui.setText(
      `HP: ${STATE.hp}   Ammo: ${STATE.ammo}/${STATE.reserve}   Score: ${STATE.score}\n` +
      `WASD bewegen | Maus zielen | LMB schießen | R reload | E looten`
    );
  }

  _setGameOver() {
    STATE.gameOver = true;
    this.isFiring = false;
    this.player.body.setVelocity(0, 0);

    this.gameOverText.setText(`GAME OVER\nScore: ${STATE.score}\n\nDrück ENTER zum Neustart`);
    this.gameOverText.setPosition(this.scale.width / 2, this.scale.height / 2);
  }
}

const config = {
  type: Phaser.AUTO,
  parent: "game",
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#000000",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [MainScene],
};

const game = new Phaser.Game(config);

window.addEventListener("resize", () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});


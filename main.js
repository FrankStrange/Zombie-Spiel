console.log("ZOMBIE MAIN START ✅");

const WORLD = { w: 2200, h: 2200 };

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

class MainScene extends Phaser.Scene {
  constructor() { super("main"); }

  preload() {
    // Generate simple textures (no external assets)
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    g.clear(); g.fillStyle(0x9be15d, 1); g.fillRect(0, 0, 22, 22);
    g.generateTexture("player", 22, 22);

    g.clear(); g.fillStyle(0xe35d5b, 1); g.fillRect(0, 0, 22, 22);
    g.generateTexture("zombie", 22, 22);

    g.clear(); g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 10, 4);
    g.generateTexture("bullet", 10, 4);

    g.clear(); g.fillStyle(0xd7a34a, 1); g.fillRect(0, 0, 18, 18);
    g.generateTexture("crate", 18, 18);

    g.clear(); g.fillStyle(0x2b3a44, 1); g.fillRect(0, 0, 32, 32);
    g.generateTexture("wall", 32, 32);

    g.destroy();
  }

  create() {
    this.cameras.main.setBackgroundColor("#0b0f12");
    this.physics.world.setBounds(0, 0, WORLD.w, WORLD.h);

    // Grid background
    const bg = this.add.graphics();
    bg.lineStyle(1, 0x1b2a33, 0.25);
    for (let x = 0; x <= WORLD.w; x += 50) bg.lineBetween(x, 0, x, WORLD.h);
    for (let y = 0; y <= WORLD.h; y += 50) bg.lineBetween(0, y, WORLD.w, y);
    bg.setDepth(-10);

    // State
    this.hp = 100;
    this.ammoMax = 12;
    this.ammo = 12;
    this.reserve = 48;
    this.score = 0;
    this.gameOver = false;

    // --- Inventory ---
    this.invOpen = false;
    this.inv = {
      ammoPack: 0,  // converts to reserve (+15 each)
      medkit: 0     // heals +25 (up to 100)
    };

    // Inventory UI (Overlay)
    this.invPanel = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 440, 270, 0x000000, 0.78)
      .setScrollFactor(0).setDepth(5000).setVisible(false);

    this.invText = this.add.text(this.scale.width / 2 - 200, this.scale.height / 2 - 115, "", {
      fontFamily: "system-ui, Segoe UI, Arial",
      fontSize: "18px",
      color: "#ffffff",
    }).setScrollFactor(0).setDepth(5001).setVisible(false);

    this.invHint = this.add.text(this.scale.width / 2 - 200, this.scale.height / 2 + 70, "", {
      fontFamily: "system-ui, Segoe UI, Arial",
      fontSize: "14px",
      color: "#cbd5e1",
    }).setScrollFactor(0).setDepth(5001).setVisible(false);


    // Player
    this.player = this.physics.add.sprite(WORLD.w / 2, WORLD.h / 2, "player");
    this.player.setCollideWorldBounds(true);
    this.playerSpeed = 260;

    // Groups
    this.zombies = this.physics.add.group();
    this.bullets = this.physics.add.group();
    this.crates = this.physics.add.staticGroup();
    this.walls = this.physics.add.staticGroup();

    // Simple houses
    this._spawnHouses();
    this._spawnCrates(18);

    // Collisions
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.zombies, this.walls);
    this.physics.add.collider(this.zombies, this.zombies);

    this.physics.add.overlap(this.bullets, this.zombies, (b, z) => {
      if (!b.active || !z.active) return;
      b.destroy();
      z.hp -= 25;
      if (z.hp <= 0) {
        z.destroy();
        this.score += 10;
      }
    });

    this.lastHitAt = 0;
    this.physics.add.overlap(this.player, this.zombies, () => {
      if (this.gameOver) return;
      const now = this.time.now;
      if (now - this.lastHitAt > 450) {
        this.lastHitAt = now;
        this.hp = clamp(this.hp - 10, 0, 100);
        if (this.hp <= 0) this._setGameOver();
      }
    });

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBounds(0, 0, WORLD.w, WORLD.h);

    // Input
    this.keys = this.input.keyboard.addKeys("W,A,S,D,E,R,ENTER,I,ONE,TWO");
    this.isFiring = false;
    this.lastShotAt = 0;
    this.fireRateMs = 120;

    this.input.on("pointerdown", (p) => { if (!this.gameOver && p.leftButtonDown()) this.isFiring = true; });
    this.input.on("pointerup", () => { this.isFiring = false; });

    // UI
    this.ui = this.add.text(12, 12, "", {
      fontFamily: "system-ui, Segoe UI, Arial",
      fontSize: "16px",
      color: "#e8f0ff",
    }).setScrollFactor(0).setDepth(1000);

    this.hint = this.add.text(12, 38, "", {
      fontFamily: "system-ui, Segoe UI, Arial",
      fontSize: "14px",
      color: "#b6c6d6",
    }).setScrollFactor(0).setDepth(1000);

    this.gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 2, "", {
      fontFamily: "system-ui, Segoe UI, Arial",
      fontSize: "36px",
      color: "#ffffff",
      align: "center",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);

    // Keep overlay centered on resize
    this.scale.on("resize", () => {
      const cx = this.scale.width / 2;
      const cy = this.scale.height / 2;

      if (this.invPanel) this.invPanel.setPosition(cx, cy);
      if (this.invText) this.invText.setPosition(cx - 200, cy - 115);
      if (this.invHint) this.invHint.setPosition(cx - 200, cy + 70);

      if (this.gameOverText) this.gameOverText.setPosition(cx, cy);
    });


    // Spawning
    this.spawnTimer = 0;
    this.spawnInterval = 1100;
    this.maxZombies = 18;

    this._updateUI();
    this._renderInventory();
  }

  update(time, delta) {
    if (this.gameOver) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER)) this.scene.restart();
      return;
    }


    // Inventory toggle
    if (Phaser.Input.Keyboard.JustDown(this.keys.I)) {
      this._toggleInventory();
    }

    // Item hotkeys (work even if inventory is closed)
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) this._useMedkit();
    if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) this._useAmmoPack();

    // If inventory is open, pause gameplay controls
    if (this.invOpen) {
      this.player.setVelocity(0, 0);
      this.isFiring = false;
      this._updateUI();
      return;
    }

    // Movement
    let vx = 0, vy = 0;
    if (this.keys.A.isDown) vx -= 1;
    if (this.keys.D.isDown) vx += 1;
    if (this.keys.W.isDown) vy -= 1;
    if (this.keys.S.isDown) vy += 1;

    const len = Math.hypot(vx, vy) || 1;
    this.player.setVelocity((vx / len) * this.playerSpeed, (vy / len) * this.playerSpeed);

    // Shoot
    if (this.isFiring && time - this.lastShotAt >= this.fireRateMs) {
      this.lastShotAt = time;
      this._tryShoot(this.input.activePointer.worldX, this.input.activePointer.worldY);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this._reload();
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this._tryLoot();

    // Zombie spawn
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      if (this.zombies.countActive(true) < this.maxZombies) this._spawnZombie();
    }

    // Zombie AI
    this.zombies.children.iterate((z) => {
      if (!z || !z.active) return;
      const dx = this.player.x - z.x;
      const dy = this.player.y - z.y;
      const dist = Math.hypot(dx, dy) || 1;
      z.setVelocity((dx / dist) * z.speed, (dy / dist) * z.speed);
    });

    this._updateUI();
    this._renderInventory();
  }


  _toggleInventory() {
    this.invOpen = !this.invOpen;
    this.invPanel.setVisible(this.invOpen);
    this.invText.setVisible(this.invOpen);
    this.invHint.setVisible(this.invOpen);
    this._renderInventory();
  }

  _renderInventory() {
    if (!this.invText || !this.invHint) return;
    this.invText.setText(
      `INVENTAR\n\n` +
      `Ammo-Packs: ${this.inv.ammoPack}\n` +
      `Medkits: ${this.inv.medkit}\n\n` +
      `Aktuell: HP ${this.hp} | Ammo ${this.ammo}/${this.reserve}`
    );

    this.invHint.setText(
      `I: schließen\n` +
      `1: Medkit benutzen (+25 HP)\n` +
      `2: Ammo-Pack -> Reserve (+15)`
    );
  }

  _useMedkit() {
    if (this.gameOver) return;
    if (!this.inv || this.inv.medkit <= 0) return;
    if (this.hp >= 100) {
      this._flashHint("HP ist schon voll");
      return;
    }
    this.inv.medkit--;
    this.hp = clamp(this.hp + 25, 0, 100);
    this._flashHint("Benutzt: Medkit (+25 HP)");
    this._renderInventory();
  }

  _useAmmoPack() {
    if (this.gameOver) return;
    if (!this.inv || this.inv.ammoPack <= 0) return;
    this.inv.ammoPack--;
    this.reserve += 15;
    this._flashHint("Benutzt: Ammo-Pack (+15 Reserve)");
    this._renderInventory();
  }


  _spawnHouses() {
    const blocks = [
      { x: 420, y: 420, w: 260, h: 180 },
      { x: 980, y: 360, w: 320, h: 220 },
      { x: 1650, y: 520, w: 260, h: 260 },
      { x: 520, y: 1280, w: 360, h: 220 },
      { x: 1200, y: 1320, w: 260, h: 320 },
      { x: 1760, y: 1420, w: 320, h: 220 },
    ];
    const t = 18;
    for (const b of blocks) {
      const doorSide = Phaser.Math.Between(0, 3);
      const door = 64;

      this._addWall(b.x, b.y - b.h / 2, b.w, t, doorSide === 0 ? door : 0);
      this._addWall(b.x, b.y + b.h / 2, b.w, t, doorSide === 1 ? door : 0);
      this._addWall(b.x - b.w / 2, b.y, t, b.h, doorSide === 2 ? door : 0);
      this._addWall(b.x + b.w / 2, b.y, t, b.h, doorSide === 3 ? door : 0);
    }
  }

  _addWall(cx, cy, w, h, gap) {
    const addBlock = (x, y, ww, hh) => {
      const s = this.walls.create(x, y, "wall");
      s.setDisplaySize(ww, hh);
      s.refreshBody();
    };

    if (!gap) return addBlock(cx, cy, w, h);

    if (w > h) {
      const seg = (w - gap) / 2;
      const off = (gap + seg) / 2;
      addBlock(cx - off, cy, seg, h);
      addBlock(cx + off, cy, seg, h);
    } else {
      const seg = (h - gap) / 2;
      const off = (gap + seg) / 2;
      addBlock(cx, cy - off, w, seg);
      addBlock(cx, cy + off, w, seg);
    }
  }

  _spawnCrates(n) {
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Between(100, WORLD.w - 100);
      const y = Phaser.Math.Between(100, WORLD.h - 100);
      const c = this.crates.create(x, y, "crate");
      c.looted = false;
    }
  }

  _spawnZombie() {
    const pad = 500;
    const side = Phaser.Math.Between(0, 3);
    let x, y;

    if (side === 0) { x = clamp(this.player.x + Phaser.Math.Between(-pad, pad), 0, WORLD.w); y = clamp(this.player.y - pad, 0, WORLD.h); }
    else if (side === 1) { x = clamp(this.player.x + Phaser.Math.Between(-pad, pad), 0, WORLD.w); y = clamp(this.player.y + pad, 0, WORLD.h); }
    else if (side === 2) { x = clamp(this.player.x - pad, 0, WORLD.w); y = clamp(this.player.y + Phaser.Math.Between(-pad, pad), 0, WORLD.h); }
    else { x = clamp(this.player.x + pad, 0, WORLD.w); y = clamp(this.player.y + Phaser.Math.Between(-pad, pad), 0, WORLD.h); }

    const z = this.zombies.create(x, y, "zombie");
    z.setCollideWorldBounds(true);
    z.hp = 50;
    z.speed = Phaser.Math.Between(90, 140);
  }

  _tryShoot(wx, wy) {
    if (this.ammo <= 0) return;
    this.ammo--;

    const b = this.bullets.create(this.player.x, this.player.y, "bullet");
    b.setCollideWorldBounds(false);

    const dx = wx - this.player.x;
    const dy = wy - this.player.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 800;

    b.setVelocity((dx / dist) * speed, (dy / dist) * speed);
    b.rotation = Math.atan2(dy, dx);

    this.physics.add.collider(b, this.walls, () => b.destroy());
    this.time.delayedCall(900, () => { if (b.active) b.destroy(); });
  }

  _reload() {
    if (this.ammo >= this.ammoMax) return;
    if (this.reserve <= 0) return;
    const need = this.ammoMax - this.ammo;
    const take = Math.min(need, this.reserve);
    this.reserve -= take;
    this.ammo += take;
  }

  _tryLoot() {
    let best = null, bestD = 999999;
    this.crates.children.iterate((c) => {
      if (!c || !c.active || c.looted) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y);
      if (d < 55 && d < bestD) { bestD = d; best = c; }
    });
    if (!best) return;

    best.looted = true;
    best.setTint(0x6b6b6b);

    const roll = Phaser.Math.Between(1, 100);
    if (roll <= 55) {
      const add = Phaser.Math.Between(1, 2);
      this.inv.ammoPack += add;
      this._flashHint(`Loot: +${add} Ammo-Pack`);
    } else {
      this.inv.medkit += 1;
      this._flashHint(`Loot: +1 Medkit`);
    }

    this.score += 2;
    this._renderInventory();

    }

  _flashHint(msg) {
    this.hint.setText(msg);
    this.time.delayedCall(1200, () => { if (!this.gameOver) this.hint.setText(""); });
  }

  _updateUI() {
    this.ui.setText(
      `HP: ${this.hp}   Ammo: ${this.ammo}/${this.reserve}   Packs: ${this.inv?.ammoPack ?? 0}   Med: ${this.inv?.medkit ?? 0}   Score: ${this.score}\n` +
      `WASD bewegen | Maus zielen | LMB schießen | R reload | E looten | I Inventar | 1 Medkit | 2 Ammo-Pack`
    );
  }

  _setGameOver() {
    this.gameOver = true;
    this.isFiring = false;
    this.player.setVelocity(0, 0);
    this.gameOverText.setText(`GAME OVER\nScore: ${this.score}\n\nDrück ENTER zum Neustart`);
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
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: [MainScene],
};

const game = new Phaser.Game(config);

window.addEventListener("resize", () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});

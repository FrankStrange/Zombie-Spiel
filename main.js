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


    // Tile textures (50x50) for a more "tilemap" look
    g.clear();
    g.fillStyle(0x12331f, 1);
    g.fillRect(0, 0, 50, 50);
    g.fillStyle(0x1b4a2b, 0.35);
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(2, 48);
      const y = Phaser.Math.Between(2, 48);
      g.fillCircle(x, y, Phaser.Math.Between(1, 3));
    }
    g.generateTexture("tile_grass", 50, 50);

    g.clear();
    g.fillStyle(0x3a2f22, 1);
    g.fillRect(0, 0, 50, 50);
    g.fillStyle(0x2b241b, 0.35);
    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(2, 48);
      const y = Phaser.Math.Between(2, 48);
      g.fillRect(x, y, Phaser.Math.Between(1, 4), Phaser.Math.Between(1, 3));
    }
    g.generateTexture("tile_dirt", 50, 50);

    g.clear();
    g.fillStyle(0x21313b, 1);
    g.fillRect(0, 0, 50, 50);
    g.lineStyle(1, 0x2f4554, 0.55);
    for (let x = 0; x <= 50; x += 10) g.lineBetween(x, 0, x, 50);
    for (let y = 0; y <= 50; y += 10) g.lineBetween(0, y, 50, y);
    g.generateTexture("tile_floor", 50, 50);

    g.clear();
    g.fillStyle(0x0a3a5a, 1);
    g.fillRect(0, 0, 50, 50);
    g.fillStyle(0x0f5278, 0.35);
    for (let i = 0; i < 10; i++) {
      const x = Phaser.Math.Between(0, 49);
      const y = Phaser.Math.Between(0, 49);
      g.fillCircle(x, y, Phaser.Math.Between(2, 6));
    }
    g.generateTexture("tile_water", 50, 50);

    g.clear();
    g.fillStyle(0x2b3a44, 1);
    g.fillRect(0, 0, 50, 50);
    g.fillStyle(0x354955, 0.35);
    g.fillRect(0, 0, 50, 6);
    g.fillRect(0, 44, 50, 6);
    g.fillRect(0, 0, 6, 50);
    g.fillRect(44, 0, 6, 50);
    g.generateTexture("tile_wall", 50, 50);

    g.clear();
    g.fillStyle(0x7aa7ff, 1);
    g.fillRect(0, 0, 50, 50);
    g.fillStyle(0x4c79b8, 0.55);
    g.fillRect(6, 6, 38, 38);
    g.generateTexture("tile_door", 50, 50);

    g.destroy();
  }

  create() {
    this.cameras.main.setBackgroundColor("#0b0f12");
    this.physics.world.setBounds(0, 0, WORLD.w, WORLD.h);
    // "Tilemap"-style background (procedural, no external assets)
    const TILE = 50;
    const cols = Math.floor(WORLD.w / TILE);
    const rows = Math.floor(WORLD.h / TILE);

    this.terrain = Array.from({ length: rows }, () => Array.from({ length: cols }, () => "grass"));

    // Dirt paths
    for (let i = 0; i < 10; i++) {
      const r = Phaser.Math.Between(2, rows - 3);
      const start = Phaser.Math.Between(1, cols - 10);
      const len = Phaser.Math.Between(8, 18);
      for (let c = start; c < Math.min(cols - 1, start + len); c++) this.terrain[r][c] = "dirt";
      if (r + 1 < rows) {
        for (let c = start; c < Math.min(cols - 1, start + len); c++) {
          if (Phaser.Math.Between(0, 100) < 40) this.terrain[r + 1][c] = "dirt";
        }
      }
    }

    // Water ponds
    this.water = this.physics.add.staticGroup();
    for (let i = 0; i < 3; i++) {
      const cx = Phaser.Math.Between(6, cols - 7);
      const cy = Phaser.Math.Between(6, rows - 7);
      const pw = Phaser.Math.Between(3, 6);
      const ph = Phaser.Math.Between(3, 5);
      for (let rr = cy - ph; rr <= cy + ph; rr++) {
        for (let cc = cx - pw; cc <= cx + pw; cc++) {
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          if (Phaser.Math.Between(0, 100) < 80) this.terrain[rr][cc] = "water";
        }
      }
    }

    const rt = this.add.renderTexture(0, 0, WORLD.w, WORLD.h).setOrigin(0, 0).setDepth(-10);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = this.terrain[r][c];
        const key = t === "dirt" ? "tile_dirt" : t === "water" ? "tile_water" : "tile_grass";
        rt.draw(key, c * TILE + TILE / 2, r * TILE + TILE / 2);

        if (t === "water") {
          const pond = this.water.create(c * TILE + TILE / 2, r * TILE + TILE / 2, "wall");
          pond.setAlpha(0);
          pond.setDisplaySize(TILE, TILE);
          pond.refreshBody();
        }
      }
    }

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
    this.doors = this.physics.add.staticGroup();
    this.furniture = this.physics.add.staticGroup();
    this.interiors = [];

    // Simple houses
    this._spawnHouses();
    this._spawnDecor();
    this._spawnCrates(20);

    // Collisions
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.player, this.doors);
    this.physics.add.collider(this.player, this.furniture);
    if (this.water) this.physics.add.collider(this.player, this.water);
    this.physics.add.collider(this.zombies, this.walls);
    this.physics.add.collider(this.zombies, this.doors);
    this.physics.add.collider(this.zombies, this.furniture);
    if (this.water) this.physics.add.collider(this.zombies, this.water);
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
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this._tryInteract();

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
    // Houses: walls + real door + interior floor + furniture; also defines interior zones for loot
    const houses = [
      { x: 420, y: 420, w: 260, h: 180 },
      { x: 980, y: 360, w: 320, h: 220 },
      { x: 1650, y: 520, w: 260, h: 260 },
      { x: 520, y: 1280, w: 360, h: 220 },
      { x: 1200, y: 1320, w: 260, h: 320 },
      { x: 1760, y: 1420, w: 320, h: 220 },
    ];

    const wallT = 18;

    for (const b of houses) {
      const doorSide = Phaser.Math.Between(0, 3);
      const doorGap = 64;

      // Interior rect (floor + furniture + loot)
      const pad = wallT + 14;
      const interior = {
        x: b.x - b.w / 2 + pad,
        y: b.y - b.h / 2 + pad,
        w: b.w - pad * 2,
        h: b.h - pad * 2,
      };
      this.interiors.push(interior);

      // Interior floor tiles
      const TILE = 50;
      const x0 = Math.floor(interior.x / TILE) * TILE;
      const y0 = Math.floor(interior.y / TILE) * TILE;
      const x1 = Math.ceil((interior.x + interior.w) / TILE) * TILE;
      const y1 = Math.ceil((interior.y + interior.h) / TILE) * TILE;

      for (let y = y0; y < y1; y += TILE) {
        for (let x = x0; x < x1; x += TILE) {
          const cx = x + TILE / 2;
          const cy = y + TILE / 2;
          if (cx < interior.x || cy < interior.y || cx > interior.x + interior.w || cy > interior.y + interior.h) continue;
          this.add.image(cx, cy, "tile_floor").setDepth(-5);
        }
      }

      // Walls (door gap on one side)
      this._addWall(b.x, b.y - b.h / 2, b.w, wallT, doorSide === 0 ? doorGap : 0);
      this._addWall(b.x, b.y + b.h / 2, b.w, wallT, doorSide === 1 ? doorGap : 0);
      this._addWall(b.x - b.w / 2, b.y, wallT, b.h, doorSide === 2 ? doorGap : 0);
      this._addWall(b.x + b.w / 2, b.y, wallT, b.h, doorSide === 3 ? doorGap : 0);

      // Furniture inside
      this._spawnFurnitureIn(interior, 3);
    }
  }

  _spawnFurnitureIn(interior, count) {
    const tries = 30;

    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let t = 0; t < tries && !placed; t++) {
        const w = Phaser.Math.Between(30, 76);
        const h = Phaser.Math.Between(22, 62);
        const x = Phaser.Math.Between(interior.x + w / 2, interior.x + interior.w - w / 2);
        const y = Phaser.Math.Between(interior.y + h / 2, interior.y + interior.h - h / 2);

        const centerDist = Phaser.Math.Distance.Between(x, y, interior.x + interior.w / 2, interior.y + interior.h / 2);
        if (centerDist < 44) continue;

        const f = this.furniture.create(x, y, "wall");
        f.setAlpha(0);
        f.setDisplaySize(w, h);
        f.refreshBody();

        const vis = this.add.rectangle(x, y, w, h, 0x6b4f3a, 0.92).setDepth(-4);
        vis.setStrokeStyle(2, 0x3b2b20, 0.6);

        placed = true;
      }
    }
  }



  _addWall(cx, cy, w, h, gap) {
    const addBlock = (x, y, ww, hh) => {
      const s = this.walls.create(x, y, "wall");
      s.setDisplaySize(ww, hh);
      s.refreshBody();

      // Visual wall tiles (tilemap look)
      const TILE = 50;
      const cols = Math.max(1, Math.round(ww / TILE));
      const rows = Math.max(1, Math.round(hh / TILE));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          this.add.image(
            x - ww / 2 + TILE / 2 + c * TILE,
            y - hh / 2 + TILE / 2 + r * TILE,
            "tile_wall"
          ).setDepth(-3);
        }
      }
    };

    const addDoor = (x, y, ww, hh) => {
      const d = this.doors.create(x, y, "wall"); // collider body
      d.setAlpha(1);
      d.setDisplaySize(ww, hh);
      d.isOpen = false;
      d.refreshBody();

      // visual
      const vis = this.add.image(x, y, "tile_door").setDepth(-2);
      vis.setDisplaySize(Math.max(ww, 22), Math.max(hh, 22));
      d._vis = vis;
    };

    if (!gap) {
      addBlock(cx, cy, w, h);
      return;
    }

    if (w > h) {
      const seg = (w - gap) / 2;
      const off = (gap + seg) / 2;
      addBlock(cx - off, cy, seg, h);
      addBlock(cx + off, cy, seg, h);
      addDoor(cx, cy, gap, h);
    } else {
      const seg = (h - gap) / 2;
      const off = (gap + seg) / 2;
      addBlock(cx, cy - off, w, seg);
      addBlock(cx, cy + off, w, seg);
      addDoor(cx, cy, w, gap);
    }
  }


  _spawnDecor() {
    // Trees & rocks as navigation/cover
    this.decor = this.physics.add.staticGroup();

    const makeTree = (x, y) => {
      const t = this.decor.create(x, y, "wall");
      t.setAlpha(0);
      t.setDisplaySize(26, 26);
      t.refreshBody();

      const crown = this.add.circle(x, y - 8, 18, 0x1f5a36, 0.95);
      const trunk = this.add.rectangle(x, y + 10, 8, 14, 0x4b3621, 0.95);
      crown.setDepth(-1);
      trunk.setDepth(-1);
    };

    const makeRock = (x, y) => {
      const r = this.decor.create(x, y, "wall");
      r.setAlpha(0);
      r.setDisplaySize(24, 18);
      r.refreshBody();

      const rock = this.add.ellipse(x, y, 28, 20, 0x6b7280, 0.9);
      rock.setDepth(-1);
    };

    for (let i = 0; i < 55; i++) {
      makeTree(Phaser.Math.Between(80, WORLD.w - 80), Phaser.Math.Between(80, WORLD.h - 80));
    }
    for (let i = 0; i < 35; i++) {
      makeRock(Phaser.Math.Between(80, WORLD.w - 80), Phaser.Math.Between(80, WORLD.h - 80));
    }

    // Collide with player/zombies
    this.physics.add.collider(this.player, this.decor);
    this.physics.add.collider(this.zombies, this.decor);
  }



  _spawnCrates(n) {
    // Spawn loot only inside house interiors
    if (!this.interiors || this.interiors.length === 0) return;

    const tryPlace = (interior) => {
      const pad = 26;
      const x = Phaser.Math.Between(interior.x + pad, interior.x + interior.w - pad);
      const y = Phaser.Math.Between(interior.y + pad, interior.y + interior.h - pad);

      let ok = true;
      this.furniture.children.iterate((f) => {
        if (!f || !f.active) return;
        const dx = Math.abs(f.x - x);
        const dy = Math.abs(f.y - y);
        if (dx < (f.displayWidth / 2 + 20) && dy < (f.displayHeight / 2 + 20)) ok = false;
      });
      return ok ? { x, y } : null;
    };

    let placed = 0;
    let safety = 0;
    while (placed < n && safety++ < n * 50) {
      const interior = Phaser.Utils.Array.GetRandom(this.interiors);
      const p = tryPlace(interior);
      if (!p) continue;

      const c = this.crates.create(p.x, p.y, "crate");
      c.looted = false;
      placed++;
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


  _tryInteract() {
    // 1) Door interaction (toggle) if near a door
    let nearest = null;
    let bestD = 999999;

    if (this.doors) {
      this.doors.children.iterate((d) => {
        if (!d || !d.active) return;
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, d.x, d.y);
        if (dist < 70 && dist < bestD) {
          bestD = dist;
          nearest = d;
        }
      });
    }

    if (nearest) {
      // toggle open/closed
      const isOpen = nearest.isOpen === true;
      if (isOpen) {
        nearest.isOpen = false;
        nearest.setAlpha(1);
        nearest.body.enable = true;
        nearest.refreshBody();
        this._flashHint("Tür geschlossen");
      } else {
        nearest.isOpen = true;
        nearest.setAlpha(0.15);
        nearest.body.enable = false; // pass through
        this._flashHint("Tür geöffnet");
      }
      return;
    }

    // 2) Otherwise loot crates
    this._tryLoot();
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
      `WASD bewegen | Maus zielen | LMB schießen | R reload | E Tür/Loot | I Inventar | 1 Medkit | 2 Ammo-Pack`
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

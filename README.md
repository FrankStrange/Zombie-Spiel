# Zombie Loot Alpha (Web)

Kleine, spielbare Alpha (Top-Down, Zombies, Loot, Schießen) – läuft komplett im Browser mit Phaser 3 (CDN).

## Starten (lokal)

Browser blocken häufig `file://`-Spiele wegen CORS/Assets. Starte deshalb einen kleinen lokalen Server:

### Option 1: Python (empfohlen)
Im Projektordner:

```bash
python -m http.server 8000
```

Dann im Browser öffnen:
- http://localhost:8000

### Option 2: Node (wenn du es hast)
```bash
npx http-server -p 8000
```

## Steuerung
- **WASD** bewegen
- **Maus** zielen
- **Linksklick** schießen (halten geht auch)
- **E** Kiste looten (wenn nah genug)
- **R** reload
- **ENTER** nach Game Over neu starten

## Nächste sinnvolle Steps
- Tilemap (Tiled) statt “Wandblöcke”
- Tür/Innenräume richtig
- Inventar UI (Slots)
- Sound & simple Particles
- Zombie-Varianten + Pathfinding (optional)

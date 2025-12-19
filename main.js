console.log("main.js läuft ✅");

const config = {
  type: Phaser.AUTO,
  parent: "game", // ⭐ DAS IST DER FIX
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#111111",
  scene: {
    create() {
      this.add.text(50, 50, "PHASER LÄUFT 🎮", {
        fontSize: "32px",
        color: "#ffffff",
      });
    },
  },
};

new Phaser.Game(config);

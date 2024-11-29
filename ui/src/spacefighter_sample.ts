import { EffectClass, EnemyClass, everyTick, GameObject, periodically, PlayerClass, ProjectileClass, whenLoaded } from "./lib/simplegame";

export function setup_spacefighter() {

    let playerClass = new PlayerClass("player", "player.png");
    let player = playerClass.spawn(180, 320);
    player.enableWasdKeysMovement();

    let playerShotClass = new ProjectileClass("playerShot", "player_shot.png");
    playerShotClass.setDefaultSpeed(400);
    
    let peonClass = new EnemyClass("peon", "peon.png");

    const explosionClass = new EffectClass("explosion", "explosion.png", 300, 50, 100);

    everyTick(() => {
        // player.setOrientation((Date.now() / 100) % 360);
    });

    periodically(1, () => {
        let shot = playerShotClass.spawnAt(player);
        shot.onCollisionWith(peonClass, (peon : GameObject) => {
            console.log("boom!");
            let explosion = explosionClass.spawnAt(peon);
            explosion.width = 100;
            explosion.height = 100;
            shot.destroy();
            peon.destroy();

        });
    });

    whenLoaded(() => {
        let peon = peonClass.spawn(180, 100);
    });

    periodically(3, () => {
        let peon = peonClass.spawn(1000*Math.random(), 1000*Math.random());
        // peon.setTarget(player);
        // peon.enableChase();
    });






}
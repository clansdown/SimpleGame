import { EnemyClass, everyTick, GameObject, periodically, PlayerClass, ProjectileClass } from "./lib/simplegame";

export function setup_spacefighter() {
    let playerClass = new PlayerClass("player", "player.png");
    let player = playerClass.spawn(180, 180);
    player.enableWasdKeysMovement();

    let playerShotClass = new ProjectileClass("playerShot", "player_shot.png");
    playerShotClass.setDefaultSpeed(400);
    
    let peonClass = new EnemyClass("peon", "peon.png");

    everyTick(() => {
        player.setOrientation((Date.now() / 100) % 360);
    });

    periodically(1, () => {
        let shot = playerShotClass.spawnAt(player);
        shot.onCollisionWith(peonClass, (peon : GameObject) => {
            console.log("boom!");
            shot.destroy();
            peon.destroy();
        });
    });

    periodically(3, () => {
        console.log("Spawning peon");
        let peon = peonClass.spawn(1000*Math.random(), 1000*Math.random());
        // peon.setTarget(player);
        // peon.enableChase();
    });





}
import { EnemyClass, everyTick, periodically, PlayerClass, ProjectileClass } from "./lib/simplegame";

/**
 * This is where you set up your game
 */
export function setup() {

    let playerClass = new PlayerClass("player", "player.png");
    let player = playerClass.spawn(180, 180);
    player.enableWasdKeysMovement();

    let playerShotClass = new ProjectileClass("playerShot", "player_shot.png");
    playerShotClass.setDefaultSpeed(400);

    everyTick(() => {
        player.setOrientation((Date.now() / 100) % 360);
    });

    periodically(1, () => {
        playerShotClass.spawnAt(player);
    });


    let peonClass = new EnemyClass("peon", "peon.png");
    periodically(3, () => {
        console.log("Spawning peon");
        let peon = peonClass.spawn(1000*Math.random(), 1000*Math.random());
        // peon.setTarget(player);
        // peon.enableChase();
    });


}
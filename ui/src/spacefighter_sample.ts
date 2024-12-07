import {  everyTick, getMousePosition, periodically, whenLoaded } from "./lib/simplegame";
import { createText, Effect, EffectClass, Enemy, EnemyClass, GameObject, PlayerClass, ProjectileClass } from "./lib/gameclasses";
import { midpoint } from "./lib/util";

export function setup_spacefighter() {
    const explosionClass = new EffectClass("explosion", "explosion.png", 300, 50, 100);
    const playerShotExplosionClass = new EffectClass("playerShotExplosion", "player_shot_explosion.png", 200, 50, 100);

    let playerClass = new PlayerClass("player", "player.png");
    
    let playerShotClass = new ProjectileClass("playerShot", "player_shot.png");
    playerShotClass.setDefaultSpeed(400);
    
    let peonClass = new EnemyClass("peon", "peon.png");
    peonClass.setBoundingBox(50, 50);
    peonClass.onDestroy((p) => {
        let explosion = explosionClass.spawnAt(p);
        explosion.growInMillis = 100;
        explosion.width = 60;
        explosion.height = 60;
    });

    const centurionClass = new EnemyClass("centurion", "centurion.png", 10);
    centurionClass.onDestroy((p) => {
        let explosion = explosionClass.spawnAt(p);
        explosion.maxDurationMillis = 500;
        explosion.growInMillis = 150;
        explosion.width = 300;
        explosion.height = 300;
        explosion.fateOutMillis = 150;
    });



    whenLoaded(() => {
        let player = playerClass.spawn(180, 320);
        player.enableWasdKeysMovement();

        everyTick(() => {
            player.setOrientationTowards(getMousePosition());
        });

        periodically(0.5, () => {
            let shot = playerShotClass.spawnAt(player);
            shot.onCollisionWithEnemy((e : GameObject) => {
                //let explosion = playerShotExplosionClass.spawnAt(midpoint(shot, e));
                let explosion = playerShotExplosionClass.spawnAt(shot);
                explosion.width = 30;
                explosion.height = 30;
                shot.destroy();
                e.takeDamage(1);
                const text = createText("1", e);
                text.foreground = "red";
                text.fadeInMillis = 100;
                text.maxDurationMillis = 300;
                text.fateOutMillis = 100;
            });
        });


        periodically(1.5, () => {
            let peon = peonClass.spawn(1000*Math.random(), 1000*Math.random());
            everyTick(() => {
                peon.setOrientationTowards(player);
                peon.move(80);
            });
        });

        periodically(10, () => {
            let centurion = centurionClass.spawn(1000*Math.random(), 1000*Math.random());
            console.log("centurion spawned with " + centurion.hitpoints + " hitpoints");
            everyTick(() => {
                centurion.setOrientationTowards(player);
                centurion.move(40);
            });
        });
    });


}
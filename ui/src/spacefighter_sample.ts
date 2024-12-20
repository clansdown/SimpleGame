import {  everyTick, getMousePosition, onKeyUp, onPause, onResume, periodically, whenLoaded } from "./lib/simplegame";
import { createText, Effect, EffectClass, Enemy, EnemyClass, GameObject, PlayerClass, ProjectileClass } from "./lib/gameclasses";
import { midpoint, scaleVector } from "./lib/util";
import { Music, SoundEffect } from "./lib/audio";

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

    const music = new Music("music/pachelbel-canon.mp3");
    music.setVolume(0.2);
    const explosionSound = new SoundEffect("music/explosion.mp3");
    
    onPause(() => {
        music.pause();
    });
    onResume(() => {
        music.play();
    });



    whenLoaded(() => {
        let player = playerClass.spawn(180, 320);
        player.enableWasdKeysMovement();
        onKeyUp(" ", () => {
            player.move(scaleVector(player.getDirection(), 400));
        });
    

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
                explosionSound.play();
            });
        });


        periodically(1.5, () => {
            let peon = peonClass.spawn(1000*Math.random(), 1000*Math.random());
            everyTick(() => {
                peon.setOrientationTowards(player);
                peon.setSpeed(80);
            });
        });

        periodically(10, () => {
            let centurion = centurionClass.spawn(1000*Math.random(), 1000*Math.random());
            console.log("centurion spawned with " + centurion.hitpoints + " hitpoints");
            everyTick(() => {
                centurion.setOrientationTowards(player);
                centurion.setSpeed(40);
            });
        });

        music.play();
    });


}
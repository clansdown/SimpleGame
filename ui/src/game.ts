import { everyTick, PlayerClass } from "./lib/simplegame";

/**
 * This is where you set up your game
 */
export function setup() {

    let playerClass = new PlayerClass("player", "player.png");
    let player = playerClass.spawn(80, 80);
    player.enableWasdKeysMovement();

    everyTick(() => {
        player.setOrientation((Date.now() / 100) % 360);
    });

}
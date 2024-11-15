/* The game engine library */

import {setup} from '../game';

let ticksPerSecond = 20;
let canvas: HTMLCanvasElement;
let lastGameLoopTime : number;

let gameObjects : GameObject[] = [];
let players : Player[] = [];
let enemies : Enemy[] = [];
let projectiles : Projectile[] = [];
let items : Item[] = [];

let tickWork : ((delta_t:number) => void)[] = [];

const keyMap = new Map<string, boolean>();
const keyMapTimes = new Map<string, number>();

let boardWidth = 10000;
let boardHeight = 10000;
let windowWidth = 1000;
let windowHeight = 1000;

export class GameObjectClass {
    name : string;
    image : HTMLImageElement;

    constructor(name : string, image_file : string) {
        this.name = name;
        this.image = new Image();
        this.image.src = image_file;
    }

    spawn(x: number, y: number) {
        // Create a new object of this type at the given location
        
    }
}

export class GameObject {
    x : number;
    y : number;
    speed : number = 200;
    x_speed : number = 0;
    y_speed : number = 0;
    /** The time it takes to reach full speed, in seconds */
    acceleration : number = 0.5;
    orientation : number;
    gameclass : GameObjectClass;
    constructor(gameclass : GameObjectClass, x : number, y : number) {
        this.gameclass = gameclass;
        this.x = x;
        this.y = y;
        this.orientation = 0;
    }

    setOrientation(angle : number) {
        this.orientation = 3.14159*angle/180;
    }

    draw(ctx : CanvasRenderingContext2D) {
        ctx.save();
        // console.log("translate to ", this.x, this.y);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.orientation);
        ctx.drawImage(this.gameclass.image, -this.gameclass.image.width / 2, -this.gameclass.image.height / 2);
        ctx.restore();
    }
}


export class PlayerClass extends GameObjectClass {
    constructor(name : string, image_file : string) {
        super(name, image_file);
    }
    spawn(x: number, y: number) : Player {
        const player = new Player(this, x, y);
        players.push(player);
        gameObjects.push(player);
        return player;
    }
}

export class Player extends GameObject {
    wasdKeys : boolean = false;
    arrowKeys : boolean = false;
    touchscreen : boolean = false;


    constructor(gameclass : PlayerClass, x : number, y : number) {
        super(gameclass, x, y);
    }

    enableArrowKeysMovement() {
        this.arrowKeys = true;
    }
    enableWasdKeysMovement() {
        this.wasdKeys = true;
    }
    enableLeftTouchscreenMovement() {
        this.touchscreen = true;
    }
}

export class ItemClass extends GameObjectClass {
    constructor(name : string, image_file : string) {
        super(name, image_file);
    }

}

export class EnemyClass extends GameObjectClass {
    constructor(name : string, image_file : string) {
        super(name, image_file);
    }

}

export class ProjectileClass extends GameObjectClass {
    constructor(name : string, image_file : string) {
        super(name, image_file);
    }

}


export class Enemy extends GameObject {

}

export class Projectile extends GameObject {

}

export class Item extends GameObject {

}


export function loadEnemy(name : string, image_file : string) : EnemyClass {
    const enemy = new EnemyClass(name, image_file);



    return enemy;
}

export function everyTick(callback : () => void) {
    // Register a callback to be called every tick
    tickWork.push(callback);
}


export function initEngine(screenCanvas: HTMLCanvasElement) {
    canvas = screenCanvas;
    canvas.addEventListener('keydown', eventHandlerKeyDown);
    canvas.addEventListener('keyup', eventHandlerKeyUp);
    canvas.focus();

    /* Call the game's setup function */
    setup();

    /* Kick off the main loop */
    lastGameLoopTime = Date.now();
    mainGameLoop();
}


function eventHandlerKeyDown(event : KeyboardEvent) {
    // Handle key presses
    let initial = keyMap.has(event.key) ? !keyMap.get(event.key) : true;
    keyMap.set(event.key, true);
    if(initial) {
        keyMapTimes.set(event.key, Date.now());
    }
    // console.log("Key Down: '" + event.key + "'", initial);
}

function eventHandlerKeyUp(event : KeyboardEvent) {
    // Handle key releases
    // console.log('Key Up: ' + event.key);
    let initial = keyMap.get(event.key) == true;
    keyMap.set(event.key, false);
    if(initial) {
        keyMapTimes.set(event.key, Date.now());
    }
}

/**
 * The main game loop
 */
function mainGameLoop() {
    const start_time = Date.now();
    const delta_t = (start_time - lastGameLoopTime)/1000;
    lastGameLoopTime = start_time;

    // User Input
    userInput();

    // Move the objects
    moveObjects(delta_t);

    // Detect Collisions

    // Take tick actions
    for(const work of tickWork) {
        work(delta_t);
    }

    // Consider timed actions

    // draw
    draw();

    // Set the timer 
    const elapsed_time = Date.now() - start_time;
    const time_to_wait = (1000 / ticksPerSecond) - elapsed_time;
    setTimeout(mainGameLoop, time_to_wait);
}

function draw() {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for(const object of gameObjects) {
        object.draw(ctx);
    }

}

function moveObjects(delta_t : number) {
    for(const object of gameObjects) {
        const normalized_x_speed = object.x_speed/object.speed;
        const normalized_y_speed = object.y_speed/object.speed;
        let norm = Math.sqrt(normalized_x_speed*normalized_x_speed + normalized_y_speed*normalized_y_speed);
        if(norm < 1)
            norm = 1;
        // console.log(object.gameclass.name,  object.x, object.y, object.x_speed, object.y_speed, "norm:", norm, "delta_t:", delta_t);
        // console.log("adding ", delta_t*(object.x_speed/norm), delta_t*(object.y_speed/norm));
        object.x += delta_t*(object.x_speed/norm);
        object.y += delta_t*(object.y_speed/norm);
        if(object.x < 0)
            object.x = 0;
        if(object.x > boardWidth)
            object.x = boardWidth;
        if(object.y < 0)
            object.y = 0;
        if(object.y > boardHeight)
            object.y = boardHeight;
    }
}

function userInput() {
    const now = Date.now();
    for(const player of players) {
        const p_accel = player.acceleration*1000;
        let key_pressed = false;
        let up = false;
        let down = false;
        let right = false;
        let left = false;
        if(player.wasdKeys) {
            if(keyMap.get('w')) {
                up = true;
            }
            if(keyMap.get('a')) {
                left = true;
            }
            if(keyMap.get('s')) {
                down = true;
            }
            if(keyMap.get('d')) {
                right = true;
            }
            // console.log("after input, player speeds:", player.x_speed, player.y_speed);
        }
        if(player.arrowKeys) {
            if(keyMap.get('ArrowUp')) {
                up = true;
            }
            if(keyMap.get('ArrowLeft')) {
                left = true;
            }
            if(keyMap.get('ArrowDown')) {
                down = true;
            }
            if(keyMap.get('ArrowRight')) {
                right = true;
            }
        }
        if(player.touchscreen) {
            // Not yet implemented
        }


        if(up) {
            const accel = Math.min(1, (now-(keyMapTimes.get('w')||0))/p_accel);
            // console.log('w', accel);
            player.y_speed = accel * -player.speed;

        }
        if(left) {
            const accel = Math.min(1, (now-(keyMapTimes.get('a')||0))/p_accel);
            player.x_speed = accel * -player.speed;
        }
        if(down) {
            const accel = Math.min(1, (now-(keyMapTimes.get('s')||0))/p_accel);
            // console.log('s', accel);
            player.y_speed = accel * player.speed;
        }
        if(right) {
            const accel = Math.min(1, (now-(keyMapTimes.get('d')||0))/p_accel);
            player.x_speed = accel * player.speed;
        }
        if(!up && !down) {
            if((keyMapTimes.get('w')||0) > (keyMapTimes.get('s')||0)) {
                const accel = Math.min(1, (now-(keyMapTimes.get('w')||0))/p_accel);
                player.y_speed = accel*player.speed - player.speed;
                //console.log('w', player.y_speed, accel);
            } else {
                const accel = Math.min(1, (now-(keyMapTimes.get('s')||0))/p_accel);
                player.y_speed = -accel*player.speed + player.speed;
                //console.log('s', player.y_speed, accel);
            }
            
        }
        if(!left && !right) {
            if((keyMapTimes.get('a')||0) > (keyMapTimes.get('d')||0)) {
                const accel = Math.min(1, (now-(keyMapTimes.get('a')||0))/p_accel);
                player.x_speed = accel*player.speed - player.speed;
            } else {
                const accel = Math.min(1, (now-(keyMapTimes.get('d')||0))/p_accel);
                player.x_speed = -accel*player.speed + player.speed;
            }
        }
    }
}

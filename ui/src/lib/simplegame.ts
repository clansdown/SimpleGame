/* The game engine library */

import {setup} from '../game';
import type { box2, matrix2 } from './util';

let ticksPerSecond = 30;
let canvas: HTMLCanvasElement;
let lastGameLoopTime : number;

let gameObjects : Set<GameObject> = new Set();
let players : Player[] = [];
let enemies : Set<Enemy> = new Set();
let projectiles : Set<Projectile> = new Set();
let items : Set<Item> = new Set();

const tickWork : ((delta_t:number) => void)[] = [];
const periodicWork : PeriodicWork[] = [];

const keyMap = new Map<string, boolean>();
const keyMapTimes = new Map<string, number>();

let boardWidth = 10000;
let boardHeight = 10000;
let windowWidth = 1000;
let windowHeight = 1000;

let gameLoopTimeout : number = -1;

class PeriodicWork {
    period : number;
    work : ()=>void;
    timeRemaining : number;

    constructor(period : number, work: ()=>void) {
        this.period = period;
        this.timeRemaining = period;
        this.work = work;
    }

    timeElapsed(delta_t : number) {
        this.timeRemaining -= delta_t;
        if(this.timeRemaining <= 0) {
            this.work();
            this.timeRemaining = this.period;
        }
    }
}

export class GameObjectClass {
    name : string;
    image : HTMLImageElement;
    defaultSpeed : number = 100;
    defaultWidth : number;
    defaultHeight : number;
    hitboxWidth : number;
    hitboxHeight : number;

    constructor(name : string, image_file : string) {
        this.name = name;
        this.image = new Image();
        this.image.src = image_file;
        this.defaultWidth = this.image.width;
        this.defaultHeight = this.image.height;
        this.hitboxWidth = this.defaultWidth;
        this.hitboxHeight = this.defaultHeight;
    }

    /**
     * Sets the default speed for spawned objects
     */
    setDefaultSpeed(speed : number) {
        this.defaultSpeed = speed;
    }

    spawn(x: number, y: number) {
        // Create a new object of this type at the given location
        
    }
}

export class GameObject {
    x : number;
    y : number;
    width: number;
    height : number;
    hitboxWidth : number;
    hitboxHeight : number;


    /** The maximum speed the object can go */
    speed : number = 200;
    x_speed : number = 0;
    y_speed : number = 0;
    /** The time it takes to reach full speed, in seconds */
    acceleration : number = 0.5;
    /** The orientation in radians, where 0 is up. */
    orientation : number;
    /** The x component of the orientation, to make movement computation more efficient */
    direction_x : number = 0;
    /** The x component of the orientation, to make movement computation more efficient */
    direction_y : number = 1;

    /** The current speed in the direction of travel */
    velocity : number = 0;

    boundToBoard : boolean = false;

    destroyIfOffBoard : boolean = false;

    standardMovement : boolean = true;

    gameclass : GameObjectClass;
    constructor(gameclass : GameObjectClass, x : number, y : number) {
        this.gameclass = gameclass;
        this.x = x;
        this.y = y;
        this.width = gameclass.defaultWidth;
        this.height = gameclass.defaultHeight;
        this.hitboxWidth = gameclass.hitboxWidth;
        this.hitboxHeight = gameclass.hitboxHeight;
        this.orientation = 0;
    }

    /**
     * Sets the orientation in degrees
     */
    setOrientation(angle : number) {
        this.orientation = Math.PI*angle/180;
        this.direction_x = Math.cos(this.orientation);
        this.direction_y = Math.sin(this.orientation);
    }

    setOrientationRadians(angle : number) {
        this.orientation = angle;
        this.direction_x = Math.cos(this.orientation - Math.PI/2);
        this.direction_y = Math.sin(this.orientation - Math.PI/2);
    }

    /**
     * Internal function to move the object
     */
    doMovement(delta_t : number) {
        this.x += this.direction_x*this.velocity*delta_t;
        this.y += this.direction_y*this.velocity*delta_t;
        console.log(this.gameclass.name, this.x, this.y, this.direction_x, this.direction_y, this.velocity, delta_t);
        if(this.boundToBoard) {
            if(this.x < 0)
                this.x = 0;
            if(this.x > boardWidth)
                this.x = boardWidth;
            if(this.y < 0)
                this.y = 0;
            if(this.y > boardHeight)
                this.y = boardHeight;
        }
        if(this.destroyIfOffBoard) {
            if(this.x < 0 || this.x > boardWidth || this.y < 0 || this.y > boardHeight) {
                this.destroy();
            }
        }
    }

    destroy() {
        gameObjects.delete(this);
    }

    /**
     * Internal function to handle drawing
     */
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
        gameObjects.add(player);
        return player;
    }
}

export class Player extends GameObject {
    wasdKeys : boolean = false;
    arrowKeys : boolean = false;
    touchscreen : boolean = false;


    constructor(gameclass : PlayerClass, x : number, y : number) {
        super(gameclass, x, y);
        this.standardMovement = false;
    }

    doMovement(delta_t: number): void {
        const normalized_x_speed = this.x_speed/this.speed;
        const normalized_y_speed = this.y_speed/this.speed;
        let norm = Math.sqrt(normalized_x_speed*normalized_x_speed + normalized_y_speed*normalized_y_speed);
        if(norm < 1)
            norm = 1;
        // console.log(this.gameclass.name,  this.x, this.y, this.x_speed, this.y_speed, "norm:", norm, "delta_t:", delta_t);
        // console.log("adding ", delta_t*(this.x_speed/norm), delta_t*(this.y_speed/norm));
        this.x += delta_t*(this.x_speed/norm);
        this.y += delta_t*(this.y_speed/norm);
        if(this.x < 0)
            this.x = 0;
        if(this.x > boardWidth)
            this.x = boardWidth;
        if(this.y < 0)
            this.y = 0;
        if(this.y > boardHeight)
            this.y = boardHeight;
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


export class EnemyClass extends GameObjectClass {
    constructor(name : string, image_file : string) {
        super(name, image_file);
    }

    spawn(x: number, y: number) : Enemy {
        const enemy = new Enemy(this, x, y);
        enemies.add(enemy);
        gameObjects.add(enemy);
        return enemy;
    }
}


export class Enemy extends GameObject {
    constructor(gameclass : EnemyClass, x : number, y : number) {
        super(gameclass, x, y);
    }

    destroy(): void {
        gameObjects.delete(this);
        enemies.delete(this);
    }
}

export class ProjectileClass extends GameObjectClass {
    constructor(name : string, image_file : string) {
        super(name, image_file);
    }

    spawn(x: number, y: number) : Projectile {
        const projectile = new Projectile(this, x, y);
        projectile.speed = this.defaultSpeed;
        projectiles.add(projectile);
        gameObjects.add(projectile);
        return projectile;
    }

    spawnAt(gameObject: GameObject) : Projectile {
        const projectile = new Projectile(this, gameObject.x, gameObject.y);
        projectile.setOrientationRadians(gameObject.orientation);
        projectile.speed = this.defaultSpeed;
        projectile.velocity = projectile.speed;
        projectiles.add(projectile);
        gameObjects.add(projectile);
        return projectile;
    }
}

export class Projectile extends GameObject {
    constructor(gameclass : ProjectileClass, x : number, y : number) {
        super(gameclass, x, y);
        this.destroyIfOffBoard = true;
        this.boundToBoard = false;
    }

    destroy(): void {
        gameObjects.delete(this);
        projectiles.delete(this);
    }

}

export class ItemClass extends GameObjectClass {
    constructor(name : string, image_file : string) {
        super(name, image_file);
    }

    spawn(x: number, y: number) : Item {
        const item = new Item(this, x, y);
        items.add(item);
        gameObjects.add(item);
        return item;
    }
}


export class Item extends GameObject {
    constructor(gameclass : ItemClass, x : number, y: number) {
        super(gameclass, x, y);
    }

    destroy(): void {
        gameObjects.delete(this);
        items.delete(this);
    }
}


export function loadEnemy(name : string, image_file : string) : EnemyClass {
    const enemy = new EnemyClass(name, image_file);



    return enemy;
}

/**
 * Register a callback to be called every tick
 */
export function everyTick(callback : () => void) {
    // Register a callback to be called every tick
    tickWork.push(callback);
}

/**
 * Register a callback to be called periodically (every so many seconds)
 */
export function periodically(seconds : number, callback : () => void) {
    periodicWork.push(new PeriodicWork(seconds, callback));
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

    /* Pause / Unpause */
    if(event.key == 'p') {
        console.log("Pause / Unpause");

        if(gameLoopTimeout >= 0) {
            /* Pause */
            clearTimeout(gameLoopTimeout);
            gameLoopTimeout = -1;
        } else {
            /* Unpause */
            lastGameLoopTime = Date.now() - 1000/ticksPerSecond;
            mainGameLoop();
        }

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
    doCollisionDetection();

    // Take tick actions
    for(const work of tickWork) {
        work(delta_t);
    }

    // Consider timed actions
    for(const work of periodicWork) {
        work.timeElapsed(delta_t);
    }

    // draw
    draw();

    // Set the timer 
    const elapsed_time = Date.now() - start_time;
    const time_to_wait = (1000 / ticksPerSecond) - elapsed_time;
    gameLoopTimeout = setTimeout(mainGameLoop, time_to_wait);
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
        object.doMovement(delta_t);
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

        // TODO: redo this in terms of velocity and direction

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
            } else {
                const accel = Math.min(1, (now-(keyMapTimes.get('s')||0))/p_accel);
                player.y_speed = -accel*player.speed + player.speed;
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


function doCollisionDetection() {





}

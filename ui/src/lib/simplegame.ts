/* The game engine library */

import { on } from 'svelte/events';
import {setup} from '../game';
import { CollisionDetector } from './collision';
import { GameObject, gameClasses, type Enemy, type GameObjectClass, type Item, type Player, type Projectile } from './gameclasses';
import type { Position2D, box2, matrix2 } from './util';



export const gameObjects : Set<GameObject> = new Set();
export const players : Player[] = [];
export const enemies : Set<Enemy> = new Set();
export const projectiles : Set<Projectile> = new Set();
export const items : Set<Item> = new Set();

const tickWork : ((delta_t:number) => void)[] = [];
const periodicWork : PeriodicWork[] = [];

const keyMap = new Map<string, boolean>();
const keyMapTimes = new Map<string, number>();
export const collisionActions : CollisionAction[] = [];
const onKeyDownMap = new Map<string, ()=>void>();
const onKeyUpMap = new Map<string, ()=>void>();
const keyEvents : KeyboardEvent[] = [];

export let boardWidth = 10000;
export let boardHeight = 10000;
let windowWidth = 1000;
let windowHeight = 1000;
/** The X-offset of the window into the board */
let windowX = 0;
/** The Y-offset of the window into the board */
let windowY = 0;

let onLoadedWork : (()=>void)[] = [];
let onPauseWork : (()=>void)[] = [];
let onResumeWork : (()=>void)[] = [];

let ticksPerSecond = 40;
let canvas: HTMLCanvasElement;
let lastGameLoopTime : number;

let gameLoopTimeout : number = -1;
let notAllClassesAreLoaded : boolean = true;

/** Mouse coordinates on the board */
let mousePosition : Position2D = {x: 0, y: 0};

let stillNeedInitialMouseClick : boolean = true;

let cameraFollowsPlayer : boolean = true;
let maxCameraMovementPerSecond = 100;

let backgroundTileset : HTMLImageElement[] = [];

export class CollisionAction {
    sourceGameClass : GameObjectClass|null;
    sourceGameObject : GameObject|null;
    targetGameClass : GameObjectClass|null;
    targetGameObject : GameObject|null;
    work : (t:GameObject, o:GameObject) => void;
    constructor(work : (t:GameObject, o:GameObject) => void, 
                        sourceClass : GameObjectClass|null, sourceObject:GameObject|null,  
                        targetClass : GameObjectClass|null, targetObject : GameObject|null) {
        this.work = work;
        this.sourceGameClass = sourceClass;
        this.sourceGameObject = sourceObject;
        this.targetGameClass = targetClass;
        this.targetGameObject = targetObject;
    }
}

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

let debugElement : HTMLDivElement;

export function initEngine(screenCanvas: HTMLCanvasElement, debugDiv : HTMLDivElement) {
    debugElement = debugDiv;
    debugElement.innerHTML = "";
    canvas = screenCanvas;
    canvas.addEventListener('keydown', eventHandlerKeyDown);
    canvas.addEventListener('keyup', eventHandlerKeyUp);
    // mouse handler
    canvas.addEventListener('mousemove', eventHandlerMouseMove);
    canvas.addEventListener('mousedown', eventHandlerMouseDown);
    canvas.addEventListener('mouseup', eventHandlerMouseUp);
    canvas.focus();

    /* Call the game's setup function */
    setup();

    /* Draw the Click to begin screen */
    drawClickToBegin();

    /* Kick off the main loop */
    lastGameLoopTime = Date.now();
    mainGameLoop();
}

function eventHandlerMouseMove(event : MouseEvent) {
    mousePosition.x = windowWidth * (event.clientX/canvas.clientWidth) + windowX;
    mousePosition.y = windowHeight * (event.clientY/canvas.clientHeight) + windowY;
}

function eventHandlerMouseDown(event : MouseEvent) {
    stillNeedInitialMouseClick = false;

    // left mouse button
    if(event.buttons & 1) {
        let initial = keyMap.has('mouse1') ? !keyMap.get('mouse1') : true;
        keyMap.set('mouse1', true);
    }
    // middle mouse button
    if(event.buttons & 4) {
        let initial = keyMap.has('mouse2') ? !keyMap.get('mouse2') : true;
        keyMap.set('mouse2', true);
    }
    // right mouse button
    if(event.buttons & 2) {
        let initial = keyMap.has('mouse3') ? !keyMap.get('mouse3') : true;
        keyMap.set('mouse3', true);
    }
}

function eventHandlerMouseUp(event : MouseEvent) {
    // left mouse button
    if(!(event.buttons & 1)) {
        let initial = keyMap.get('mouse1') == true;
        keyMap.set('mouse1', false);
    }
    // middle mouse button
    if(!(event.buttons & 4)) {
        let initial = keyMap.get('mouse2') == true;
        keyMap.set('mouse2', false);
    }
    // right mouse button
    if(!(event.buttons & 2)) {
        let initial = keyMap.get('mouse3') == true;
        keyMap.set('mouse3', false);
    }
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
            for(const work of onPauseWork) {
                work();
            }
        } else {
            /* Unpause */
            for(const work of onResumeWork) {
                work();
            }
            lastGameLoopTime = Date.now() - 1000/ticksPerSecond;
            mainGameLoop();
        }

    }

    keyEvents.push(event);
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
    keyEvents.push(event);
}

function allClassesLoaded() : boolean {
    for(const gameclass of gameClasses) {
        if(!gameclass.loaded) {
            return false;
        }
    }
    return true;
}

/**
 * The main game loop
 */
function mainGameLoop() {
    /* Check for initial input */
    if(stillNeedInitialMouseClick) {
        gameLoopTimeout = setTimeout(mainGameLoop, 1000/ticksPerSecond);
        return;
    }

    /* Don't go through with the main loop until all game classes have loaded their resources */
    if(notAllClassesAreLoaded) {
        if(allClassesLoaded()) {
            notAllClassesAreLoaded = false;
            lastGameLoopTime = Date.now();
            for(const work of onLoadedWork) {
                work();
            }
        } else {
            console.log("Not all classes are loaded yet");
            gameLoopTimeout = setTimeout(mainGameLoop, 1000/ticksPerSecond);
            return;
        }
    }

    /* Set up the loop */
    const start_time = Date.now();
    const delta_t = (start_time - lastGameLoopTime)/1000;
    lastGameLoopTime = start_time;
    // console.log("delta_t:", delta_t);

    updateDurations(delta_t);

    // User Input
    userInput();

    // Move the objects
    moveObjects(delta_t);

    // Detect Collisions
    let cd = doCollisionDetection();

    // Take tick actions
    for(const work of tickWork) {
        work(delta_t);
    }

    // Consider timed actions
    for(const work of periodicWork) {
        work.timeElapsed(delta_t);
    }

    /* Update the camera */
    updateCamera(delta_t);

    // draw
    draw();

    // dsdebugDrawBoundingBoxes(cd);

    // Set the timer 
    const elapsed_time = Date.now() - start_time;
    const time_to_wait = (1000 / ticksPerSecond) - elapsed_time;
    gameLoopTimeout = setTimeout(mainGameLoop, time_to_wait);
}

function updateCamera(delta_t : number) {
    if(cameraFollowsPlayer) {
        if(players.length > 0) {
            const player = players[0];
            let x = player.x - windowWidth/2;
            let y = player.y - windowHeight/2;
            x = Math.max(0, Math.min(boardWidth - windowWidth, x));
            y = Math.max(0, Math.min(boardHeight - windowHeight, y));
            if(Math.abs(x - windowX) > delta_t*maxCameraMovementPerSecond) {
                x = windowX + Math.sign(x - windowX)*delta_t*maxCameraMovementPerSecond;
            }
            if(Math.abs(y - windowY) > delta_t*maxCameraMovementPerSecond) {
                y = windowY + Math.sign(y - windowY)*delta_t*maxCameraMovementPerSecond;
            }
            windowX = x;
            windowY = y;
            // console.log("Camera at", windowX, windowY);
        }
    }
}

function updateDurations(delta_t : number) {
    for(const object of gameObjects) {
        object.timeExistedMillis += delta_t*1000;
        if(object.maxDurationMillis > 0 && object.timeExistedMillis > object.maxDurationMillis) {
            object.destroy();
        }
    }
}

function draw() {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    /* Background */
    if(backgroundTileset.length > 0) {
        const tileWidth = backgroundTileset[0].width;
        const tileHeight = backgroundTileset[0].height;

        const base_x = Math.floor(windowX/tileWidth)*tileWidth;
        const base_y = Math.floor(windowY/tileHeight)*tileHeight;

        for(let x = base_x; x <= base_x + windowWidth + tileWidth; x += tileWidth) {
            for(let y = base_y; y <= base_y + windowHeight + tileHeight; y += tileHeight) {
                const img = backgroundTileset[Math.floor(randFromCoordinates(Math.floor(x/tileWidth), Math.floor(y/tileWidth))*backgroundTileset.length)];
                ctx.drawImage(img, x-windowX, y-windowY);
            }
        }
    }

    /* Objects */
    for(const object of gameObjects) {
        object.draw(ctx, windowX, windowY);
    }

}

function randFromCoordinates(x : number, y : number) : number {
    const hash = x*123456789 + y*987654321;
    let rand = Math.sin(hash)*100000;
    return rand - Math.floor(rand);
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
   
    /* Handle Key Events */
    for(const event of keyEvents) {
        const key = event.key;
        if(event.type == 'keydown') {
            const callback = onKeyDownMap.get(key);
            if(callback) {
                callback();
            }
        } else if(event.type == 'keyup') {
            const callback = onKeyUpMap.get(key);
            if(callback) {
                callback();
            }
        }
    }
    keyEvents.length = 0;
}

export function whenLoaded(work : ()=>void) {
    onLoadedWork.push(work);
}

export function onPause(work : ()=>void) {
    onPauseWork.push(work);
}

export function onResume(work : ()=>void) {
    onResumeWork.push(work);
}

function doCollisionDetection() : CollisionDetector{
    // console.log("Doing collision detection");
    const detector = new CollisionDetector(boardWidth, boardHeight);
    for(const action of collisionActions) {
        if(action.sourceGameClass) {
            

        }
        if(action.sourceGameObject) {
            if(action.targetGameClass) {
                const tag = action.targetGameClass.name;
                // console.log("Building tree for ", tag);
                detector.buildTree(tag, action.targetGameClass.getAllGameObjects(new Set<GameObject>()));
                const collisions = detector.detectCollisions([action.sourceGameObject], [tag]);
                for(const collision of collisions) {
                    action.work(action.sourceGameObject, collision);
                }
            }
            if(action.targetGameObject) {
                // Just directly check if they collide

            }
        }

    }
    return detector;
}

function debugDrawBoundingBoxes(detector : CollisionDetector) {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.strokeStyle = 'white';
    for(const o of detector.getCollisionObjects()) {
        for(let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(o.hitbox[i*2], o.hitbox[i*2+1]);
            ctx.lineTo(o.hitbox[((i+1)%4)*2], o.hitbox[((i+1)%4)*2+1]);
            ctx.stroke();
        }
    }

}

export function debug(text : string) {
    if(debugElement)
        debugElement.innerHTML = text;
    else
        console.log(text);
}

export function getMousePosition() : Position2D {
    return mousePosition;
}

function drawClickToBegin() {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("Click to Begin", canvas.width/2, canvas.height/2);
}

export function setCameraFollowsPlayer(follows : boolean) {
    cameraFollowsPlayer = follows;
}

export function onKeyDown(key : string, callback : ()=>void) {
    onKeyDownMap.set(key, callback);
}

export function onKeyUp(key : string, callback : ()=>void) {
    onKeyUpMap.set(key, callback);
}

export function onButtonDown(button : number, callback : ()=>void) {
    
}

export function onButtonUp(button : number, callback : ()=>void) {
    
}


/**
 * Sets the background to be one or more tiles (they must be the same size) given by file names
 * If there is more than one, the tiles will be randomly selected for their locations in the backgrounds so that
 * there won't be a repetition pattern in the tiling. The larger the number of tiles, the better the effect will be.
 */
export function setBackground(tiles: string[], whenLoaded: ()=>void = ()=>{}) {
    const images : HTMLImageElement[] = [];
    let count_unloaded = tiles.length;
    for(const tile of tiles) {
        const img = new Image();
        img.src = tile;
        images.push(img);
        img.onload = () => {
            if(--count_unloaded <= 0) {
                backgroundTileset = images;
                whenLoaded();
            }
        };
    }
}

export function setBoardSize(width : number, height : number) {
    boardWidth = width;
    boardHeight = height;
}
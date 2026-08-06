/* The game engine library */

import { on } from 'svelte/events';
import { CollisionDetector } from './collision';
import {setup as defaultSetup} from '../game';
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
const onMouseClickMap = new Map<number, (event: MouseEvent, x: number, y: number) => void>();
const mouseDownTimes = new Map<string, number>();
const mouseOwner = new Map<number, GameObject>();

export let boardWidth = 10000;
export let boardHeight = 10000;
let windowWidth = 1000;
let windowHeight = 1000;
/** The X-offset of the window into the board */
let windowX = 0;
/** The Y-offset of the window into the board */
let windowY = 0;

export let buttonDebugLevel = 0;
export function setButtonDebugLevel(level: number): void {
    buttonDebugLevel = level;
}

let onLoadedWork : (()=>void)[] = [];
let onPauseWork : (()=>void)[] = [];
let onResumeWork : (()=>void)[] = [];
const afterDrawWork : ((ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number) => void)[] = [];

let ticksPerSecond = 40;
let canvas: HTMLCanvasElement;
let lastGameLoopTime : number;

let gameLoopTimeout : number = -1;
let notAllClassesAreLoaded : boolean = true;

/** Mouse coordinates on the board */
let mousePosition : Position2D = {x: 0, y: 0};

let dragTarget : GameObject | null = null;
let dragButton : number = -1;
let dragCandidate : GameObject | null = null;
let dragCandidateStartX : number = 0;
let dragCandidateStartY : number = 0;
const DRAG_THRESHOLD = 10;

// Board panning (drag-to-scroll the viewport)
let boardPanEnabled: boolean = false;
let boardPanning: boolean = false;
let boardPanStartViewportFracX: number = 0;
let boardPanStartViewportFracY: number = 0;
let boardPanStartWindowX: number = 0;
let boardPanStartWindowY: number = 0;
let boardPanRate: number = 1.0;
let boardPanSuppressClick: boolean = false;
let boardPanCursorOriginal: string = '';

// Zoom
let zoomEnabled: boolean = false;
let zoomLevel: number = 1.0;
let zoomMin: number = 0.5;
let zoomMax: number = 3.0;
let zoomStep: number = 0.1;
let nominalWindowWidth: number = 1000;
let nominalWindowHeight: number = 1000;
let pinchActive: boolean = false;
let pinchStartDistance: number = 0;
let pinchStartZoomLevel: number = 1.0;
let pinchMidFracX: number = 0;
let pinchMidFracY: number = 0;

let stillNeedInitialMouseClick : boolean = true;

let cameraFollowsPlayer : boolean = true;
let maxCameraMovementPerSecond = 100;

let backgroundTileset : HTMLImageElement[] = [];
let backgroundMode: "tile" | "stretch" = "tile";
let backgroundTileWidth: number | null = null;
let backgroundTileHeight: number | null = null;
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

function isPointInHitbox(obj: GameObject, x: number, y: number): boolean {
    const left = obj.x + obj.hitboxXOffset - obj.hitboxWidth / 2;
    const right = obj.x + obj.hitboxXOffset + obj.hitboxWidth / 2;
    const top = obj.y + obj.hitboxYOffset - obj.hitboxHeight / 2;
    const bottom = obj.y + obj.hitboxYOffset + obj.hitboxHeight / 2;
    return x >= left && x <= right && y >= top && y <= bottom;
}

/**
 * Checks if an object and all its ancestors in the attachment chain are visible.
 */
function isVisible(obj: GameObject): boolean {
    let current: GameObject | null = obj;
    while (current) {
        if (!current.visible) return false;
        current = current.attachedTo;
    }
    return true;
}

function handleMouseDown(button: number, key: string, event: MouseEvent, boardX: number, boardY: number) {
    let initial = keyMap.has(key) ? !keyMap.get(key) : true;
    keyMap.set(key, true);
    if (initial) {
        mouseDownTimes.set(key, Date.now());
        let hitCount = 0;
        let best: GameObject | null = null;
        let bestZ = -Infinity;

        for (const obj of gameObjects) {
            if (!isVisible(obj)) continue;
            const hit = isPointInHitbox(obj, boardX, boardY);
            if (hit) {
                hitCount++;
                const hasHandler = obj.onMouseDownMap.has(button) || obj.onMouseUpMap.has(button) || obj.onClickMap.has(button);
                if (hasHandler && obj.zIndex > bestZ) {
                    bestZ = obj.zIndex;
                    best = obj;
                }
            }
            if (buttonDebugLevel >= 10) {
                console.log(
                    `[ButtonDebug]   mousedown obj="${obj.gameclass.name}" ` +
                    `pos=(${obj.x.toFixed(1)},${obj.y.toFixed(1)}) ` +
                    `hitbox=${obj.hitboxWidth}x${obj.hitboxHeight} ` +
                    `offset=(${obj.hitboxXOffset},${obj.hitboxYOffset}) ` +
                    `mouse=(${boardX.toFixed(1)},${boardY.toFixed(1)}) ` +
                    `hit=${hit}`
                );
            }
        }

        if (best) {
            mouseOwner.set(button, best);
            const handler = best.onMouseDownMap.get(button);
            if (handler) {
                handler(event);
                if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] handleMouseDown: mousedown obj=${best.gameclass.name} button=${button}`);
            }
        } else {
            mouseOwner.delete(button);
        }

        if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] handleMouseDown: button=${button} checked ${gameObjects.size} objects, ${hitCount} hit`);
    }
}

function handleMouseUp(button: number, key: string, event: MouseEvent, boardX: number, boardY: number) {
    let initial = keyMap.get(key) == true;
    keyMap.set(key, false);
    let clickHandled = false;
    if (initial) {
        const owner = mouseOwner.get(button);
        if (owner) {
            mouseOwner.delete(button);
            const upHandler = owner.onMouseUpMap.get(button);
            if (upHandler) {
                upHandler(event);
                if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] handleMouseUp: up obj=${owner.gameclass.name} button=${button}`);
            }
            const clickHandler = owner.onClickMap.get(button);
            if (clickHandler && !owner.isDragging) {
                clickHandler(event);
                clickHandled = true;
                if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] handleMouseUp: click obj=${owner.gameclass.name} button=${button}`);
            }
        }
        if (!clickHandled && !boardPanSuppressClick) {
            const now = Date.now();
            if ((now - (mouseDownTimes.get(key) || 0)) <= 600) {
                const callback = onMouseClickMap.get(button);
                if (callback) callback(event, boardX, boardY);
            }
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

export function initEngine(screenCanvas: HTMLCanvasElement, debugDiv : HTMLDivElement, clickToBegin: boolean = true, setupFn: () => void = defaultSetup) {
    debugElement = debugDiv;
    debugElement.innerHTML = "";
    canvas = screenCanvas;
    windowWidth = canvas.width;
    windowHeight = canvas.height;
    nominalWindowWidth = canvas.width;
    nominalWindowHeight = canvas.height;
    attachEventListeners();

    if (!clickToBegin) {
        stillNeedInitialMouseClick = false;
    }

    /* Call the game's setup function */
    setupFn();

    /* Draw the Click to begin screen if needed */
    if (clickToBegin) {
        drawClickToBegin();
    }

    /* Kick off the main loop */
    lastGameLoopTime = Date.now();
    mainGameLoop();
}

/**
 * Attaches all event listeners to the current canvas.
 * Connects keyboard (keydown, keyup) and mouse (mousemove, mousedown, mouseup) handlers.
 * Should be called after setting or changing the canvas.
 */
export function attachEventListeners() {
    canvas.addEventListener('keydown', eventHandlerKeyDown);
    canvas.addEventListener('keyup', eventHandlerKeyUp);
    canvas.addEventListener('mousemove', eventHandlerMouseMove);
    canvas.addEventListener('mousedown', eventHandlerMouseDown);
    canvas.addEventListener('mouseup', eventHandlerMouseUp);
    canvas.addEventListener('touchstart', eventHandlerTouchStart, { passive: false });
    canvas.addEventListener('touchmove', eventHandlerTouchMove, { passive: false });
    canvas.addEventListener('touchend', eventHandlerTouchEnd, { passive: false });
    canvas.addEventListener('wheel', eventHandlerWheel, { passive: false });
    canvas.focus();
}

/**
 * Removes all event listeners from the current canvas.
 * Disconnects keyboard and mouse handlers to prevent memory leaks when switching canvases.
 */
export function removeEventListeners() {
    canvas.removeEventListener('keydown', eventHandlerKeyDown);
    canvas.removeEventListener('keyup', eventHandlerKeyUp);
    canvas.removeEventListener('mousemove', eventHandlerMouseMove);
    canvas.removeEventListener('mousedown', eventHandlerMouseDown);
    canvas.removeEventListener('mouseup', eventHandlerMouseUp);
    canvas.removeEventListener('touchstart', eventHandlerTouchStart);
    canvas.removeEventListener('touchmove', eventHandlerTouchMove);
    canvas.removeEventListener('touchend', eventHandlerTouchEnd);
    canvas.removeEventListener('wheel', eventHandlerWheel);
}

/**
 * Assigns a new canvas to the game engine. Removes event listeners from the old canvas
 * and attaches them to the new one. Use this when you want to switch the rendering target.
 *
 * @param newCanvas - The new HTMLCanvasElement to use for rendering and input
 * @example
 *   const newCanvas = document.getElementById('game-canvas-2');
 *   setCanvas(newCanvas);
 */
export function setCanvas(newCanvas: HTMLCanvasElement) {
    if (canvas) {
        removeEventListeners();
    }
    canvas = newCanvas;
    attachEventListeners();
}

function eventHandlerMouseMove(event : MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    mousePosition.x = windowWidth * ((event.clientX - rect.left) / canvas.clientWidth) + windowX;
    mousePosition.y = windowHeight * ((event.clientY - rect.top) / canvas.clientHeight) + windowY;

    if (dragCandidate && !dragTarget) {
        const dx = mousePosition.x - dragCandidateStartX;
        const dy = mousePosition.y - dragCandidateStartY;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
            dragTarget = dragCandidate;
            dragCandidate = null;
            dragTarget.isDragging = true;
            dragTarget.velocity = 0;
            const handler = dragTarget.onDragStartMap.get(dragButton);
            if (handler) handler();
            if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] dragStart: obj=${dragTarget.gameclass.name} at (${dragTarget.x}, ${dragTarget.y})`);
        }
    }

    detectHover();

    if (dragTarget) {
        if (dragTarget.dragFollowsCursor) {
            dragTarget.x = mousePosition.x;
            dragTarget.y = mousePosition.y;
            dragTarget.velocity = 0;
        }
        const handler = dragTarget.onDragMap.get(dragButton);
        if (handler) handler();
        if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] drag: target=${dragTarget.gameclass.name} to (${mousePosition.x}, ${mousePosition.y})`);
    }

    // Board panning: compute delta in viewport-fraction space, convert to board units
    if (boardPanning) {
        const currentFracX = (event.clientX - rect.left) / canvas.clientWidth;
        const currentFracY = (event.clientY - rect.top) / canvas.clientHeight;
        const deltaFracX = currentFracX - boardPanStartViewportFracX;
        const deltaFracY = currentFracY - boardPanStartViewportFracY;
        windowX = Math.max(0, Math.min(boardWidth - windowWidth, boardPanStartWindowX - deltaFracX * windowWidth * boardPanRate));
        windowY = Math.max(0, Math.min(boardHeight - windowHeight, boardPanStartWindowY - deltaFracY * windowHeight * boardPanRate));
        // Recompute mouse position since windowX/windowY changed
        mousePosition.x = windowWidth * ((event.clientX - rect.left) / canvas.clientWidth) + windowX;
        mousePosition.y = windowHeight * ((event.clientY - rect.top) / canvas.clientHeight) + windowY;
    }
}

function eventHandlerMouseDown(event : MouseEvent) {
    stillNeedInitialMouseClick = false;
    const rect = canvas.getBoundingClientRect();
    const boardX = windowWidth * ((event.clientX - rect.left) / canvas.clientWidth) + windowX;
    const boardY = windowHeight * ((event.clientY - rect.top) / canvas.clientHeight) + windowY;

    if (event.buttons & 1) {
        for (const obj of [...gameObjects]) {
            if (obj.draggable && obj.canDrag() && !obj.isDragging && !dragTarget && !dragCandidate && isPointInHitbox(obj, boardX, boardY) && isVisible(obj)) {
                dragCandidate = obj;
                dragButton = 0;
                dragCandidateStartX = boardX;
                dragCandidateStartY = boardY;
                if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] dragCandidate: obj=${obj.gameclass.name} at (${boardX}, ${boardY})`);
                break;
            }
        }
    }

    if (event.buttons & 1) handleMouseDown(0, 'mouse1', event, boardX, boardY);
    if (event.buttons & 4) handleMouseDown(1, 'mouse2', event, boardX, boardY);
    if (event.buttons & 2) handleMouseDown(2, 'mouse3', event, boardX, boardY);

    // Board panning: start on left-click when nothing captured it
    if (boardPanEnabled && (event.buttons & 1) && !dragCandidate && !mouseOwner.has(0) && !boardPanning) {
        boardPanning = true;
        boardPanStartViewportFracX = (event.clientX - rect.left) / canvas.clientWidth;
        boardPanStartViewportFracY = (event.clientY - rect.top) / canvas.clientHeight;
        boardPanStartWindowX = windowX;
        boardPanStartWindowY = windowY;
        boardPanCursorOriginal = canvas.style.cursor;
        canvas.style.cursor = 'none';
    }
}

function eventHandlerMouseUp(event : MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const boardX = windowWidth * ((event.clientX - rect.left) / canvas.clientWidth) + windowX;
    const boardY = windowHeight * ((event.clientY - rect.top) / canvas.clientHeight) + windowY;

    // Board panning: end on left-button release, suppress click
    if (boardPanning && !(event.buttons & 1)) {
        boardPanning = false;
        boardPanSuppressClick = true;
        canvas.style.cursor = boardPanCursorOriginal;
    }

    if (!(event.buttons & 1)) handleMouseUp(0, 'mouse1', event, boardX, boardY);
    if (!(event.buttons & 4)) handleMouseUp(1, 'mouse2', event, boardX, boardY);
    if (!(event.buttons & 2)) handleMouseUp(2, 'mouse3', event, boardX, boardY);

    boardPanSuppressClick = false;

    if (dragCandidate) {
        dragCandidate = null;
        dragButton = -1;
    }

    if (dragTarget) {
        if ((dragButton === 0 && !(event.buttons & 1)) ||
            (dragButton === 1 && !(event.buttons & 4)) ||
            (dragButton === 2 && !(event.buttons & 2))) {
            if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] dragEnd: obj=${dragTarget.gameclass.name} at (${dragTarget.x}, ${dragTarget.y})`);
            dragTarget.isDragging = false;
            const handler = dragTarget.onDragEndMap.get(dragButton);
            if (handler) handler();
            dragTarget = null;
            dragButton = -1;
        }
    }
}

/**
 * Single-finger touch drag synthesises left-button mouse events so
 * the engine's existing mousedown / mousemove / mouseup handlers
 * automatically get board panning, object dragging, and clicks.
 * Only the first touch (changedTouches[0]) is tracked.
 */
function eventHandlerTouchStart(event: TouchEvent): void {
    if (zoomEnabled && event.touches.length === 2) {
        if (dragCandidate) {
            const synth = new MouseEvent('mouseup', { clientX: 0, clientY: 0, button: 0, buttons: 0 });
            canvas.dispatchEvent(synth);
        }
        if (mouseOwner.has(0)) {
            const rect = canvas.getBoundingClientRect();
            const bx = windowWidth * 0.5 + windowX;
            const by = windowHeight * 0.5 + windowY;
            const synth = new MouseEvent('mouseup', { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0, buttons: 0 });
            canvas.dispatchEvent(synth);
        }
        if (boardPanning) {
            boardPanning = false;
            canvas.style.cursor = boardPanCursorOriginal;
            boardPanSuppressClick = false;
        }
        pinchActive = true;
        const t0 = event.touches[0];
        const t1 = event.touches[1];
        pinchStartDistance = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        pinchStartZoomLevel = zoomLevel;
        const rect = canvas.getBoundingClientRect();
        pinchMidFracX = ((t0.clientX + t1.clientX) / 2 - rect.left) / canvas.clientWidth;
        pinchMidFracY = ((t0.clientY + t1.clientY) / 2 - rect.top) / canvas.clientHeight;
        event.preventDefault();
        return;
    }
    if (pinchActive) return;
    event.preventDefault();
    const touch = event.changedTouches[0];
    canvas.dispatchEvent(new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        buttons: 1,
    }));
}

function eventHandlerTouchMove(event: TouchEvent): void {
    if (pinchActive) {
        event.preventDefault();
        if (event.touches.length >= 2) {
            const t0 = event.touches[0];
            const t1 = event.touches[1];
            const currentDistance = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
            const ratio = currentDistance / pinchStartDistance;
            const newZoom = Math.max(zoomMin, Math.min(zoomMax, pinchStartZoomLevel * ratio));
            if (newZoom === zoomLevel) return;

            const oldWindowWidth = windowWidth;
            const oldWindowHeight = windowHeight;

            windowWidth = nominalWindowWidth / newZoom;
            windowHeight = nominalWindowHeight / newZoom;

            windowX = windowX + (oldWindowWidth - windowWidth) * pinchMidFracX;
            windowY = windowY + (oldWindowHeight - windowHeight) * pinchMidFracY;
            windowX = Math.max(0, Math.min(boardWidth - windowWidth, windowX));
            windowY = Math.max(0, Math.min(boardHeight - windowHeight, windowY));

            zoomLevel = newZoom;
            const rect = canvas.getBoundingClientRect();
            mousePosition.x = windowWidth * ((t0.clientX + t1.clientX) / 2 - rect.left) / canvas.clientWidth + windowX;
            mousePosition.y = windowHeight * ((t0.clientY + t1.clientY) / 2 - rect.top) / canvas.clientHeight + windowY;
        }
        return;
    }
    event.preventDefault();
    const touch = event.changedTouches[0];
    canvas.dispatchEvent(new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        buttons: 1,
    }));
}

function eventHandlerTouchEnd(event: TouchEvent): void {
    if (pinchActive) {
        if (event.touches.length < 2) {
            pinchActive = false;
            boardPanSuppressClick = false;
        }
        return;
    }
    event.preventDefault();
    const touch = event.changedTouches[0];
    canvas.dispatchEvent(new MouseEvent('mouseup', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        buttons: 0,
    }));
}

function eventHandlerWheel(event: WheelEvent): void {
    if (!zoomEnabled) return;
    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const fracX = (event.clientX - rect.left) / canvas.clientWidth;
    const fracY = (event.clientY - rect.top) / canvas.clientHeight;

    const delta = event.deltaY > 0 ? -zoomStep : zoomStep;
    const newZoom = Math.max(zoomMin, Math.min(zoomMax, zoomLevel + delta));
    if (newZoom === zoomLevel) return;

    const oldWindowWidth = windowWidth;
    const oldWindowHeight = windowHeight;

    windowWidth = nominalWindowWidth / newZoom;
    windowHeight = nominalWindowHeight / newZoom;

    windowX = windowX + (oldWindowWidth - windowWidth) * fracX;
    windowY = windowY + (oldWindowHeight - windowHeight) * fracY;
    windowX = Math.max(0, Math.min(boardWidth - windowWidth, windowX));
    windowY = Math.max(0, Math.min(boardHeight - windowHeight, windowY));

    zoomLevel = newZoom;
    mousePosition.x = windowWidth * fracX + windowX;
    mousePosition.y = windowHeight * fracY + windowY;
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
        togglePause();
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
        for (const sprite of gameclass.damageSprites) {
            if (!sprite.loaded) {
                return false;
            }
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

    if (zoomEnabled) {
        ctx.save();
        ctx.scale(zoomLevel, zoomLevel);
    }

    /* Background */
    if(backgroundTileset.length > 0) {
        if(backgroundMode === "stretch") {
            ctx.drawImage(backgroundTileset[0], 0, 0, windowWidth, windowHeight);
        } else {
            const customW = backgroundTileWidth;
            const customH = backgroundTileHeight;
            const hasCustomSize = customW !== null && customH !== null;
            const tileWidth  = hasCustomSize ? customW! : backgroundTileset[0].width;
            const tileHeight = hasCustomSize ? customH! : backgroundTileset[0].height;

            const base_x = Math.floor(windowX/tileWidth)*tileWidth;
            const base_y = Math.floor(windowY/tileHeight)*tileHeight;

            for(let x = base_x; x <= base_x + windowWidth + tileWidth; x += tileWidth) {
                for(let y = base_y; y <= base_y + windowHeight + tileHeight; y += tileHeight) {
                    const img = backgroundTileset[Math.floor(randFromCoordinates(Math.floor(x/tileWidth), Math.floor(y/tileWidth))*backgroundTileset.length)];
                    if (hasCustomSize) {
                        ctx.drawImage(img, x-windowX, y-windowY, tileWidth, tileHeight);
                    } else {
                        ctx.drawImage(img, x-windowX, y-windowY);
                    }
                }
            }
        }
    }

    /* Objects */
    for(const object of [...gameObjects].sort((a, b) => a.zIndex - b.zIndex)) {
        if (isVisible(object)) {
            object.draw(ctx, windowX, windowY);
        }
    }

    /* After-draw hooks (overlays, etc.) */
    for(const work of afterDrawWork) {
        work(ctx, windowX, windowY);
    }

    if (zoomEnabled) {
        ctx.restore();
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
        if(!player.arrowKeys && !player.wasdKeys && !player.touchscreen) {
            continue;
        }
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

function detectHover() {
    if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] detectHover: ${gameObjects.size} objects, mouse (${mousePosition.x}, ${mousePosition.y})`);
    for (const obj of [...gameObjects]) {
        if (!isVisible(obj)) {
            if (obj.isHovered) {
                obj.isHovered = false;
                if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] mouseOut: obj=${obj.gameclass.name} (hidden)`);
                const handler = obj.onMouseOutMap.get(0);
                if (handler) handler(new MouseEvent('mouseout'));
            }
            continue;
        }
        const wasHovered = obj.isHovered;
        obj.isHovered = isPointInHitbox(obj, mousePosition.x, mousePosition.y);
        if (buttonDebugLevel >= 10) {
            const hit = obj.isHovered;
            const left = obj.x + obj.hitboxXOffset - obj.hitboxWidth / 2;
            const right = obj.x + obj.hitboxXOffset + obj.hitboxWidth / 2;
            const top = obj.y + obj.hitboxYOffset - obj.hitboxHeight / 2;
            const bottom = obj.y + obj.hitboxYOffset + obj.hitboxHeight / 2;
            console.log(
                `[ButtonDebug]   obj="${obj.gameclass.name}" ` +
                `pos=(${obj.x.toFixed(1)},${obj.y.toFixed(1)}) ` +
                `hitbox=${obj.hitboxWidth}x${obj.hitboxHeight} ` +
                `offset=(${obj.hitboxXOffset},${obj.hitboxYOffset}) ` +
                `bounds=[${left.toFixed(1)}-${right.toFixed(1)}, ${top.toFixed(1)}-${bottom.toFixed(1)}] ` +
                `hit=${hit}`
            );
        }
        if (obj.isHovered && !wasHovered) {
            if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] mouseOver: obj=${obj.gameclass.name} at (${obj.x}, ${obj.y})`);
            const handler = obj.onMouseOverMap.get(0);
            if (handler) handler(new MouseEvent('mouseover'));
        } else if (!obj.isHovered && wasHovered) {
            if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] mouseOut: obj=${obj.gameclass.name}`);
            const handler = obj.onMouseOutMap.get(0);
            if (handler) handler(new MouseEvent('mouseout'));
        }
    }
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

export function pauseGame(): void {
    if (gameLoopTimeout < 0) return;
    clearTimeout(gameLoopTimeout);
    gameLoopTimeout = -1;
    for (const work of onPauseWork) work();
}

export function resumeGame(): void {
    if (gameLoopTimeout >= 0) return;
    for (const work of onResumeWork) work();
    lastGameLoopTime = Date.now() - 1000 / ticksPerSecond;
    mainGameLoop();
}

export function togglePause(): void {
    if (gameLoopTimeout >= 0) pauseGame();
    else resumeGame();
}

export function isPaused(): boolean {
    return gameLoopTimeout < 0;
}

export function afterDraw(callback: (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number) => void): void {
    afterDrawWork.push(callback);
}

/**
 * Clears all registered {@link afterDraw} callbacks. Use this before
 * registering new afterDraw work so you don't need to track old
 * callback references.
 *
 * @example
 *   clearAfterDraw();
 *   afterDraw((ctx, ox, oy) => { drawHud(ctx); });
 */
export function clearAfterDraw(): void {
    afterDrawWork.length = 0;
}

function doCollisionDetection() : CollisionDetector{
    const detector = new CollisionDetector(boardWidth, boardHeight);
    const alreadyCollided = new Set<GameObject>();

    for(const action of collisionActions) {
        const source = action.sourceGameObject;
        if (!source) continue;

        if (source.singleCollisionOnly && alreadyCollided.has(source)) continue;

        if(action.targetGameClass) {
            const tag = action.targetGameClass.name;
            detector.buildTree(tag, action.targetGameClass.getAllGameObjects(new Set<GameObject>()));
            const collisions = detector.detectCollisions([source], [tag]);
            for(const collision of collisions) {
                action.work(source, collision);
                if (source.singleCollisionOnly) {
                    alreadyCollided.add(source);
                    break;
                }
            }
        }

        if(action.targetGameObject) {
            const objDetector = new CollisionDetector(boardWidth, boardHeight);
            if(objDetector.collides(source, action.targetGameObject)) {
                action.work(source, action.targetGameObject);
                if (source.singleCollisionOnly) {
                    alreadyCollided.add(source);
                }
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

export function onMouseClick(button: number, handler: (event: MouseEvent, x: number, y: number) => void) {
    onMouseClickMap.set(button, handler);
}

export function onButtonDown(button : number, callback : ()=>void) {
    
}

export function onButtonUp(button : number, callback : ()=>void) {
    
}


export function setBackgroundMode(mode: "tile" | "stretch"): void {
    backgroundMode = mode;
}

/**
 * Enables or disables board panning — dragging the viewport by
 * left-clicking or touching empty space (no game object underneath).
 * The user should call {@link setCameraFollowsPlayer | `setCameraFollowsPlayer(false)`}
 * to prevent the camera from fighting manual panning.
 *
 * @param enabled - `true` to allow panning, `false` (default) to disable
 */
export function setBoardPanEnabled(enabled: boolean): void {
    boardPanEnabled = enabled;
    if (!enabled && boardPanning) {
        boardPanning = false;
        canvas.style.cursor = boardPanCursorOriginal;
    }
}

/**
 * Sets the pan speed multiplier. Controls how much board space the
 * viewport travels relative to the cursor movement across the viewport.
 *
 * @param rate - Pan speed multiplier (default `1.0`, 1:1 grip)
 * @example
 *   setBoardPanRate(0.5);  // slow — 2× drag to cross the viewport
 *   setBoardPanRate(2.0);  // fast — half a drag to cross the viewport
 */
export function setBoardPanRate(rate: number): void {
    boardPanRate = rate;
}

/**
 * Returns whether the board is currently being dragged by the user
 * (mouse or touch).
 */
export function isBoardPanning(): boolean {
    return boardPanning;
}

/**
 * Enables or disables zoom (mouse wheel and touch pinch).
 * When disabled the viewport resets to 1× zoom.
 *
 * @param enabled - `true` to enable zoom, `false` (default) to disable
 * @param min     - Minimum zoom level (default `0.5`)
 * @param max     - Maximum zoom level (default `3.0`)
 * @param step    - Zoom increment per wheel notch (default `0.1`)
 * @example
 *   setZoomEnabled(true, 0.25, 4.0);
 */
export function setZoomEnabled(enabled: boolean, min: number = 0.5, max: number = 3.0, step: number = 0.1): void {
    zoomEnabled = enabled;
    zoomMin = min;
    zoomMax = max;
    zoomStep = step;
    if (!enabled) {
        windowWidth = nominalWindowWidth;
        windowHeight = nominalWindowHeight;
        zoomLevel = 1.0;
        pinchActive = false;
    }
}

/**
 * Sets the zoom level programmatically (clamped to min/max).
 * Intended for manual zoom controls rather than continuous input.
 *
 * @param level - Desired zoom level (1.0 = no zoom)
 * @example
 *   setZoomLevel(2.0);  // 2× zoom-in
 */
export function setZoomLevel(level: number): void {
    if (!zoomEnabled) return;
    zoomLevel = Math.max(zoomMin, Math.min(zoomMax, level));
    windowWidth = nominalWindowWidth / zoomLevel;
    windowHeight = nominalWindowHeight / zoomLevel;
    windowX = Math.max(0, Math.min(boardWidth - windowWidth, windowX));
    windowY = Math.max(0, Math.min(boardHeight - windowHeight, windowY));
}

/**
 * Returns the current zoom factor (1.0 = native, >1 = zoomed in).
 */
export function getZoomLevel(): number {
    return zoomLevel;
}

/**
 * Moves the camera so the given board coordinates appear at the centre
 * of the viewport. The position is clamped to keep the viewport on the
 * board — the camera will never show space beyond the board boundary.
 *
 * Call {@link setCameraFollowsPlayer | `setCameraFollowsPlayer(false)`}
 * first if you want the camera to stay where you put it; otherwise the
 * player-following logic will override it on the next tick.
 *
 * @param centerX - The x-coordinate (board units) to centre on
 * @param centerY - The y-coordinate (board units) to centre on
 * @example
 *   setCameraFollowsPlayer(false);
 *   setCameraPosition(500, 300);
 */
export function setCameraPosition(centerX: number, centerY: number): void {
    windowX = Math.max(0, Math.min(boardWidth - windowWidth, centerX - windowWidth / 2));
    windowY = Math.max(0, Math.min(boardHeight - windowHeight, centerY - windowHeight / 2));
}

/**
 * Changes the canvas pixel resolution and the engine's nominal viewport
 * size. Use this to set the viewport aspect ratio — at 1× zoom the
 * visible board area matches the pixel dimensions of the canvas.
 *
 * Re-clamps the camera position so the viewport stays on the board
 * after the resize.
 *
 * @param width  - New viewport width in board units / canvas pixels
 * @param height - New viewport height in board units / canvas pixels
 * @example
 *   setViewportSize(1920, 1080);  // 16:9 widescreen viewport
 */
export function setViewportSize(width: number, height: number): void {
    canvas.width = width;
    canvas.height = height;
    nominalWindowWidth = width;
    nominalWindowHeight = height;
    windowWidth = nominalWindowWidth / zoomLevel;
    windowHeight = nominalWindowHeight / zoomLevel;
    windowX = Math.max(0, Math.min(boardWidth - windowWidth, windowX));
    windowY = Math.max(0, Math.min(boardHeight - windowHeight, windowY));
}

/**
 * Sets the tile size in board coordinates for tiled backgrounds.
 * Both width and height must be set; images will be scaled to fit.
 *
 * @param width  - Tile width in board units
 * @param height - Tile height in board units
 */
export function setBackgroundTileSize(width: number, height: number): void {
    backgroundTileWidth = width;
    backgroundTileHeight = height;
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
        img.onerror = () => {
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

/**
 * Sets the game board dimensions (width and height in game coordinates).
 * This is an alias for setBoardSize. Use to change the virtual world size.
 *
 * @param width - The width of the game board in game coordinate units
 * @param height - The height of the game board in game coordinate units
 * @example
 *   setSize(1920, 1080);
 */
export function setSize(width: number, height: number) {
    boardWidth = width;
    boardHeight = height;
}

/**
 * Clears all game objects and assets from the engine.
 * Destroys all game objects and empties all collections including players, enemies,
 * projectiles, items, and collision actions. Also resets camera position to origin.
 *
 * @example
 *   clear(); // Use this when resetting or restarting a game
 */
export function clear() {
    for (const obj of [...gameObjects]) {
        obj.gameclass.destroy(obj);
    }
    gameObjects.clear();
    players.length = 0;
    enemies.clear();
    projectiles.clear();
    items.clear();
    collisionActions.length = 0;
    for (const gc of gameClasses) {
        gc.gameObjects.clear();
    }
    dragTarget = null;
    dragCandidate = null;
    dragButton = -1;
    mouseOwner.clear();
    boardPanning = false;
    boardPanSuppressClick = false;
    windowX = 0;
    windowY = 0;
    if (zoomEnabled) {
        zoomLevel = 1.0;
        windowWidth = nominalWindowWidth;
        windowHeight = nominalWindowHeight;
    }
}

/**
 * Completely shuts down the game engine: stops the game loop, unbinds
 * all DOM event listeners, clears all game objects, callbacks, input
 * state, and engine flags. Releases every resource the engine holds.
 *
 * After calling this, the engine must be re-initialised with
 * {@link initEngine} before it can be used again.
 *
 * Use {@link clear} instead when you only want to reset game objects
 * for a level restart without tearing down the engine infrastructure.
 *
 * @example
 *   // Svelte onDestroy
 *   onDestroy(() => { destroyEngine(); });
 *
 *   // React useEffect cleanup
 *   useEffect(() => {
 *       initEngine(canvas, debugDiv);
 *       return () => { destroyEngine(); };
 *   }, []);
 */
export function destroyEngine(): void {
    // Stop the game loop
    if (gameLoopTimeout >= 0) {
        clearTimeout(gameLoopTimeout);
        gameLoopTimeout = -1;
    }

    // Remove DOM event listeners from the canvas
    if (canvas) {
        removeEventListeners();
    }

    // Clear game objects, drag state, mouseOwner, camera position
    clear();

    // Clear callback registries
    tickWork.length = 0;
    periodicWork.length = 0;
    onLoadedWork.length = 0;
    onPauseWork.length = 0;
    onResumeWork.length = 0;
    afterDrawWork.length = 0;
    onKeyDownMap.clear();
    onKeyUpMap.clear();
    onMouseClickMap.clear();

    // Clear input state
    keyMap.clear();
    keyMapTimes.clear();
    keyEvents.length = 0;
    mouseDownTimes.clear();
    mousePosition = { x: 0, y: 0 };

    // Clear game classes (images get GC'd when user's refs are dropped)
    gameClasses.length = 0;

    // Clear background
    backgroundTileset = [];

    // Reset engine flags
    notAllClassesAreLoaded = true;
    stillNeedInitialMouseClick = true;

    // Reset camera/board/window to defaults
    boardWidth = 10000;
    boardHeight = 10000;
    cameraFollowsPlayer = true;
    maxCameraMovementPerSecond = 100;
    backgroundMode = "tile";
    backgroundTileWidth = null;
    backgroundTileHeight = null;
    boardPanEnabled = false;
    boardPanRate = 1.0;
    zoomEnabled = false;
    zoomLevel = 1.0;
    zoomMin = 0.5;
    zoomMax = 3.0;
    zoomStep = 0.1;
    pinchActive = false;
    canvas.style.cursor = '';
}

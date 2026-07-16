import { gameObjects, enemies, collisionActions, CollisionAction, boardWidth, boardHeight, players, projectiles, items } from "./simplegame";
import type { Position2D, vec2 } from "./util";

/**
 * Options for circular/orbital movement via GameObject.circleAround().
 *
 * The object sweeps an arc around a center point at a fixed radius,
 * with configurable facing direction, optional fade-in/out velocity
 * ramps, and an optional arc limit with completion callback.
 *
 * All angle parameters use polar coordinates (0 = right, π/2 = down
 * in screen coordinates, π = left, 3π/2 = up) and are relative to
 * the center's local coordinate system when center is a GameObject.
 *
 * @param center - The point or GameObject to orbit. When a GameObject,
 *   the orbit position and facing are recomputed every frame relative
 *   to the center's current location and orientation.
 * @param radius - Orbit radius in board units.
 * @param velocity - Linear speed along the circular path (board units/sec).
 * @param startAngleRad - Starting position on the circle in radians.
 *   Ignored if startAngleDeg is also provided.
 * @param startAngleDeg - Starting position on the circle in degrees.
 *   Takes precedence over startAngleRad.
 * @param facing - Direction vector {x, y} specifying the object's
 *   facing direction in a local frame where:
 *   - x-axis = clockwise tangent of the circle
 *   - y-axis = radially outward from centre
 *   Default: {x: 1, y: 0} (clockwise tangent — race-car style).
 *   Common values:
 *     {1, 0}  → clockwise tangent
 *     {0, 1}  → directly away from centre
 *     {0, -1} → directly toward centre
 *     {-1, 0} → counter-clockwise tangent
 * @param fadeInTime - Seconds over which velocity ramps from 0 to
 *   full at the start of the orbit. Default 0.
 * @param fadeOutTime - Seconds over which velocity ramps to 0 near
 *   the end of the arc. Only meaningful when arcDeg/arcRad is set.
 *   Default 0.
 * @param arcRad - Total arc to sweep in radians. Omit to orbit
 *   indefinitely (or until cancelCircleAround() is called).
 * @param arcDeg - Total arc to sweep in degrees. Takes precedence
 *   over arcRad. Omit for indefinite orbit.
 * @param onComplete - Called once after the arc is fully traversed.
 *   The object is snapped to the exact final position before the
 *   callback fires.
 */
export interface CircleAroundOptions {
    center: Position2D | GameObject;
    radius: number;
    velocity: number;
    startAngleRad?: number;
    startAngleDeg?: number;
    facing?: { x: number; y: number };
    fadeInTime?: number;
    fadeOutTime?: number;
    arcRad?: number;
    arcDeg?: number;
    onComplete?: () => void;
}

export const gameClasses : GameObjectClass[] = [];

export class GameObjectClass {
    name : string;
    image : HTMLImageElement;
    defaultSpeed : number = 100;
    defaultWidth : number = 0;
    defaultHeight : number = 0;
    hitboxWidth : number = 0;
    hitboxHeight : number = 0;
    hitboxXOffset : number = 0;
    hitboxYOffset : number = 0;
    loaded : boolean = false;
    defaultHitpoints : number = 1;
    /** The direction the raw sprite image faces. [0, -1] = up, [1, 0] = right, etc. Inherited by all spawned instances. */
    defaultSpriteForwardVector: vec2 = [0, -1];
    /** Default value for singleCollisionOnly on spawned instances */
    defaultSingleCollisionOnly: boolean = false;

    parent : GameObjectClass|null;
    children : Set<GameObjectClass> = new Set();

    /** If set, work to be done when the object is destroyed */
    onDestroyWork? : (o:GameObject)=>void;

    /**
     * The set of all objects of this class
     */
    gameObjects : Set<GameObject> = new Set();

    // TODO: implement the idea of inheritance, so it is possible to create a child class of a GameObjectClass; this will have implications for other
    // things in the system like collision trees

    constructor(name : string, image_file : string|null, parent : GameObjectClass|null, hitpoints : number = 1) {
        this.name = name;
        this.defaultHitpoints = hitpoints;
        if(image_file) {
            this.image = new Image();
            this.image.onload = () => {
                if(this.defaultWidth == 0)
                    this.defaultWidth = this.image.width;
                if(this.defaultHeight == 0)
                    this.defaultHeight = this.image.height;
                if(this.hitboxWidth == 0)
                    this.hitboxWidth = this.defaultWidth;
                if(this.hitboxHeight == 0)
                    this.hitboxHeight = this.defaultHeight;
                this.loaded = true;
            }
            this.image.onerror = () => {
                if(this.defaultWidth == 0)
                    this.defaultWidth = 32;
                if(this.defaultHeight == 0)
                    this.defaultHeight = 32;
                if(this.hitboxWidth == 0)
                    this.hitboxWidth = this.defaultWidth;
                if(this.hitboxHeight == 0)
                    this.hitboxHeight = this.defaultHeight;
                this.loaded = true;
            }
            this.image.src = image_file;
        } else {
            this.image = new Image();
            this.loaded = true;
        }
        gameClasses.push(this);
        if(parent) {
            this.parent = parent;
            parent.addChild(this);
        } else {
            this.parent = null;
        }
    }

    addChild(child : GameObjectClass) {
        this.children.add(child);
    }

    /**
     * Sets the default speed for spawned objects
     */
    setDefaultSpeed(speed : number) {
        this.defaultSpeed = speed;
    }

    setBoundingBox(width : number, height : number, x_offset : number = 0, y_offset : number = 0) {
        this.hitboxWidth = width;
        this.hitboxHeight = height;
        this.hitboxXOffset = x_offset;
        this.hitboxYOffset = y_offset;
    }

    spawn(x: number, y: number) {
        // Create a new object of this type at the given location
        // This probably shouldn't be used directly
        console.log("Spawn not implemented for ", this.name);
    }

    protected spawned(object : GameObject) {
        this.gameObjects.add(object);
        gameObjects.add(object);
    }

    public onDestroy(work : (o : GameObject)=>void) {
        this.onDestroyWork = work;
    }

    public destroy(object : GameObject) {
        if(this.onDestroyWork) {
            this.onDestroyWork(object);
        }
        gameObjects.delete(object);
        this.gameObjects.delete(object);
        // scan through the collision actions and remove any that involve this object
        for(const action of collisionActions) {
            if(action.sourceGameObject === object || action.targetGameObject === object) {
                collisionActions.splice(collisionActions.indexOf(action), 1);
            }
        }
    }

    onCollisionWith(other : GameObjectClass, work : (t : GameObject, o:GameObject)=>void) {
        collisionActions.push(new CollisionAction(work, this, null, other, null));
    }

    /**
     * Adds all game objects to the provided set
     * NOTE: modifies the provided set
     * @returns the set proivided
     */
    getAllGameObjects(ds : Set<GameObject>) : Set<GameObject> {
        for(const o of this.gameObjects) {
            ds.add(o);
        }
        for(const child of this.children) {
            child.getAllGameObjects(ds);
        }

        return ds;
    }
}

export class GameObject {
    hitpoints : number;
    x : number;
    y : number;
    width: number;
    height : number;
    hitboxWidth : number;
    hitboxHeight : number;
    hitboxXOffset : number;
    hitboxYOffset : number;

    /** Where users should hang their variables, e.g. var.hp, var.level, var.numberOfPowerUps, etc. */
    var : any = {};

    attachedObjects : AttachedGameObject[] = [];

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
    /** The y component of the orientation, to make movement computation more efficient */
    direction_y : number = 1;

    /** When true, mirrors the sprite horizontally when movement direction is > 90° from spriteForwardVector. Useful for side-view games. */
    mirrorOnDirection: boolean = false;
    /** The direction the raw sprite image faces. Inherited from class defaultSpriteForwardVector at spawn. [0, -1] = up, [1, 0] = right, etc. */
    spriteForwardVector: vec2 = [0, -1];
    /** If true, stops collision detection for this object after the first hit per frame. Inherited from class defaultSingleCollisionOnly. */
    singleCollisionOnly: boolean = false;

    /** The current speed in the direction of travel */
    velocity : number = 0;

    /** The target destination for moveTo movement. Null if no destination set. */
    destination : Position2D | null = null;
    /** The distance from the destination at which deceleration begins. */
    decelerationDistance : number = 4;
    /** The number of seconds for the minimum deceleration velocity. Higher values allow slower final approach. */
    decelerationTime : number = 1.0;

    /** Non-null when this object is in circular orbit. Managed by circleAround() / cancelCircleAround(). */
    protected circleState: {
        center: Position2D | GameObject;
        radius: number;
        currentAngle: number;
        angularVelocity: number;
        elapsed: number;
        facingX: number;
        facingY: number;
        fadeInTime: number;
        fadeOutTime: number;
        arcRad: number | null;
        completedArcRad: number;
        onComplete: (() => void) | null;
    } | null = null;

    boundToBoard : boolean = false;

    destroyIfOffBoard : boolean = false;

    standardMovement : boolean = true;

    /** Whether this object can be resized by parent layout containers */
    layoutCanResizeMe : boolean = true;
    /** Whether this object should be maximized in the x direction within its container */
    maximizeX : boolean = false;
    /** Whether this object should be maximized in the y direction within its container */
    maximizeY : boolean = false;

    /** The object this is attached to, if any */
    attachedTo : GameObject|null = null;

    /** Whether this object is visible and interactive. Hiding a container hides all attached children via ancestor-chain checks in the engine. */
    visible: boolean = true;

    gameclass : GameObjectClass;

    isHovered: boolean = false;
    onClickMap: Map<number, (event: MouseEvent) => void> = new Map();
    onMouseDownMap: Map<number, (event: MouseEvent) => void> = new Map();
    onMouseUpMap: Map<number, (event: MouseEvent) => void> = new Map();
    onMouseOverMap: Map<number, (event: MouseEvent) => void> = new Map();
    onMouseOutMap: Map<number, (event: MouseEvent) => void> = new Map();

    draggable: boolean = false;
    isDragging: boolean = false;

    canDrag(): boolean {
        return true;
    }
    dragFollowsCursor: boolean = true;
    onDragStartMap: Map<number, () => void> = new Map();
    onDragMap: Map<number, () => void> = new Map();
    onDragEndMap: Map<number, () => void> = new Map();

    fadeInMillis : number = 0;
    growInMillis : number = 0;
    fateOutMillis : number = 0;
    growOutMillis : number = 0;

    /**
     * If not zero, how long this object should exist for; will auto-destroy after this time
     */
    maxDurationMillis : number = 0;

    /**
     * How long this object has existed for
     */
    timeExistedMillis : number = 0;

    onDestroyWork? : ()=>void;
    onArrivalWork? : () => void;

    constructor(gameclass : GameObjectClass, x : number, y : number) {
        this.gameclass = gameclass;
        this.x = x;
        this.y = y;
        this.hitpoints = gameclass.defaultHitpoints;
        this.width = gameclass.defaultWidth;
        this.height = gameclass.defaultHeight;
        this.hitboxWidth = gameclass.hitboxWidth;
        this.hitboxHeight = gameclass.hitboxHeight;
        this.hitboxXOffset = gameclass.hitboxXOffset;
        this.hitboxYOffset = gameclass.hitboxYOffset;
        this.orientation = 0;
        this.speed = gameclass.defaultSpeed;
        this.spriteForwardVector = [...gameclass.defaultSpriteForwardVector];
        this.singleCollisionOnly = gameclass.defaultSingleCollisionOnly;
    }

    onClick(button: number, handler: (event: MouseEvent) => void) {
        this.onClickMap.set(button, handler);
    }

    onMouseDown(button: number, handler: (event: MouseEvent) => void) {
        this.onMouseDownMap.set(button, handler);
    }

    onMouseUp(button: number, handler: (event: MouseEvent) => void) {
        this.onMouseUpMap.set(button, handler);
    }

    onMouseOver(button: number, handler: (event: MouseEvent) => void) {
        this.onMouseOverMap.set(button, handler);
    }

    onMouseOut(button: number, handler: (event: MouseEvent) => void) {
        this.onMouseOutMap.set(button, handler);
    }

    onDragStart(button: number, handler: () => void) {
        this.onDragStartMap.set(button, handler);
    }

    onDrag(button: number, handler: () => void) {
        this.onDragMap.set(button, handler);
    }

    onDragEnd(button: number, handler: () => void) {
        this.onDragEndMap.set(button, handler);
    }

    /**
     * Sets the maximum duration in milliseconds
     */
    setMaxDuration(millis : number) {
        this.maxDurationMillis = millis;
    }

    protected updateAttached() {
        for (const attached of this.attachedObjects) {
            attached.update(this);
        }
    }

    /**
     * Sets the orientation in degrees
     */
    setOrientation(angle : number) {
        this.orientation = Math.PI*angle/180;
        this.direction_x = Math.cos(this.orientation - Math.PI/2);
        this.direction_y = Math.sin(this.orientation - Math.PI/2);
        this.updateAttached();
    }

    setOrientationRadians(angle : number) {
        this.orientation = angle;
        this.direction_x = Math.cos(this.orientation - Math.PI/2);
        this.direction_y = Math.sin(this.orientation - Math.PI/2);
        this.updateAttached();
    }

    setOrientationTowards(pos : Position2D) {
        const dx = pos.x - this.x;
        const dy = pos.y - this.y;
        this.orientation = Math.atan2(dy, dx) + Math.PI/2;
        // debug("Setting orientation towards " + pos.x + ", " + pos.y + " from " + this.x + ", " + this.y + " to " + this.orientation);
        this.direction_x = Math.cos(this.orientation - Math.PI/2);
        this.direction_y = Math.sin(this.orientation - Math.PI/2);
        this.updateAttached();
    }

    /** Sets the speed */
    setSpeed(speed : number) {
        this.velocity = speed;
    }

    getDirection() : vec2 {
        return [this.direction_x, this.direction_y];
    }

    logMovement(): void {
        const destDist = this.destination
            ? Math.sqrt(
                (this.destination.x - this.x) ** 2 +
                (this.destination.y - this.y) ** 2
              ).toFixed(2)
            : "none";
        console.log(
            `[MoveDebug] "${this.gameclass.name}" ` +
            `pos=(${this.x.toFixed(1)}, ${this.y.toFixed(1)}) ` +
            `vel=${this.velocity.toFixed(2)} ` +
            `dir=(${this.direction_x.toFixed(3)}, ${this.direction_y.toFixed(3)}) ` +
            `dest=${this.destination ? `(${this.destination.x}, ${this.destination.y})` : "null"} ` +
            `dist=${destDist} ` +
            `decelDist=${this.decelerationDistance} ` +
            `bound=${this.boundToBoard} ` +
            `destroyOff=${this.destroyIfOffBoard} ` +
            `drag=${this.draggable}/${this.isDragging}`
        );
    }

    /**
     * Moves the object by the given vector
     */
    move(vector : vec2) {
        this.x += vector[0];
        this.y += vector[1];
        this.updateAttached();
    }

    /**
     * Sets the new location of the object without any kind of movement, in absolute coordinatesr
     */
    setLocation(x : number, y : number) {
        this.x = x;
        this.y = y;
        this.updateAttached();
    }

    /**
     * Moves the object to the specified position in the given time.
     * Sets orientation to face the destination and calculates velocity to arrive on schedule.
     * Deceleration is applied automatically when within decelerationDistance of destination.
     *
     * @param position - The target position to move to
     * @param time - The time in seconds to complete the movement
     * @example
     *   enemy.moveTo({x: 1000, y: 500}, 3.0); // Moves to position over 3 seconds
     */
    moveTo(position: Position2D, time: number) {
        this.circleState = null;
        const dx = position.x - this.x;
        const dy = position.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        this.destination = position;
        this.setOrientationTowards(position);
        this.velocity = distance / time;
    }

    /**
     * Moves the object in a circular orbit around a center point.
     * Position and facing are updated every frame until the optional
     * arc is completed or cancelCircleAround() is called.
     *
     * The center can be a fixed point ({x, y}) or a GameObject. When
     * orbiting a GameObject, the orbit follows the centre's movement
     * and rotation automatically — all positions and facing directions
     * are computed relative to the centre's current location and
     * orientation every frame.
     *
     * Calling circleAround() cancels any active moveTo. Calling
     * moveTo() cancels any active circleAround.
     *
     * @param options - Orbit configuration (see CircleAroundOptions).
     *
     * @example
     *   // Orbit a fixed point, face tangent, one full loop
     *   enemy.circleAround({
     *       center: { x: 500, y: 300 },
     *       radius: 150,
     *       velocity: 100,
     *       startAngleDeg: 0,
     *       facing: { x: 1, y: 0 },
     *       arcDeg: 360,
     *       onComplete: () => enemy.destroy(),
     *   });
     *
     * @example
     *   // Hover around player, face outward, smooth start
     *   drone.circleAround({
     *       center: player,
     *       radius: 80,
     *       velocity: 40,
     *       startAngleRad: 0,
     *       facing: { x: 0, y: 1 },
     *       fadeInTime: 0.5,
     *   });
     */
    circleAround(options: CircleAroundOptions): void {
        const startAngleRad = options.startAngleDeg != null
            ? options.startAngleDeg * Math.PI / 180
            : options.startAngleRad ?? 0;

        const arcRad = options.arcDeg != null
            ? options.arcDeg * Math.PI / 180
            : options.arcRad ?? null;

        const facingX = options.facing?.x ?? 1;
        const facingY = options.facing?.y ?? 0;
        const facingLen = Math.sqrt(facingX * facingX + facingY * facingY);
        const normFacingX = facingLen > 0 ? facingX / facingLen : 1;
        const normFacingY = facingLen > 0 ? facingY / facingLen : 0;

        this.destination = null;

        this.circleState = {
            center: options.center,
            radius: options.radius,
            currentAngle: startAngleRad,
            angularVelocity: options.velocity / options.radius,
            elapsed: 0,
            facingX: normFacingX,
            facingY: normFacingY,
            fadeInTime: options.fadeInTime ?? 0,
            fadeOutTime: options.fadeOutTime ?? 0,
            arcRad: arcRad,
            completedArcRad: 0,
            onComplete: options.onComplete ?? null,
        };
    }

    /**
     * Cancels an active circular orbit. The object stops at its current
     * position and resumes normal behaviour (stationary, moveTo, etc.)
     * on the next frame.
     */
    cancelCircleAround(): void {
        this.circleState = null;
    }

    /**
     * Registers a callback that fires when the object reaches its moveTo destination.
     *
     * @param callback - The function to call on arrival
     * @example
     *   player.moveTo({x: 500, y: 300}, 2.0);
     *   player.onArrival(() => console.log("Arrived!"));
     */
    onArrival(callback: () => void): void {
        this.onArrivalWork = callback;
    }

    /**
     * Attaches another GameObject to this one with the specified offsets and orientation offset.
     */
    attach(gameObject: GameObject, offsetX: number, offsetY: number, orientationOffset: number) {
        const attached = new AttachedGameObject(gameObject, offsetX, offsetY, orientationOffset);
        this.attachedObjects.push(attached);
        gameObject.attachedTo = this;
    }

    /**
     * Detaches the specified GameObject from this one.
     */
    detach(gameObject: GameObject) {
        this.attachedObjects = this.attachedObjects.filter(attached => attached.gameObject !== gameObject);
        gameObject.attachedTo = null;
    }

    /**
     * Internal function to move the object
     */
    doMovement(delta_t : number) {
        // Attached objects don't move independently
        if (this.attachedTo) {
            return;
        }

        // Circular orbit takes precedence over all other movement
        if (this.circleState) {
            this.updateCircleMovement(delta_t);
            this.updateAttached();
            return;
        }

        // Handle destination-based movement with deceleration
        if (this.destination) {
            const dx = this.destination.x - this.x;
            const dy = this.destination.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Check if reached destination (within 0.01 tolerance)
            if (distance <= 0.01) {
                this.x = this.destination.x;
                this.y = this.destination.y;
                this.velocity = 0;
                this.destination = null;
                if (this.onArrivalWork) {
                    this.onArrivalWork();
                }
                this.updateAttached();
                return;
            }

            // Apply deceleration if within decelerationDistance
            if (distance <= this.decelerationDistance && this.velocity > 0) {
                const distanceRatio = distance / this.decelerationDistance;
                const deceleratedVelocity = this.velocity * distanceRatio;
                const minimumVelocity = this.velocity / this.decelerationTime;
                this.velocity = Math.max(deceleratedVelocity, minimumVelocity);
            }

            // Recalculate direction toward destination
            this.setOrientationTowards(this.destination);

            // Prevent overshoot — snap to destination if step exceeds remaining distance
            const stepDistance = this.velocity * delta_t;
            if (stepDistance >= distance) {
                this.x = this.destination.x;
                this.y = this.destination.y;
                this.velocity = 0;
                this.destination = null;
                if (this.onArrivalWork) {
                    this.onArrivalWork();
                }
                this.updateAttached();
                return;
            }
        }

        this.x += this.direction_x*this.velocity*delta_t;
        this.y += this.direction_y*this.velocity*delta_t;
        // console.log(this.gameclass.name, this.x, this.y, this.direction_x, this.direction_y, this.velocity, delta_t);
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
        this.updateAttached();
    }

    /**
     * Updates position and facing for a circular orbit every frame.
     * Called from doMovement() when circleState is set.
     *
     * Handles:
     *   - Angular position computation from velocity and elapsed time
     *   - Fade-in: velocity ramp from 0 over fadeInTime seconds
     *   - Fade-out: velocity ramp to 0 as remaining arc shrinks
     *   - Position relative to center (with rotation if center is GameObject)
     *   - Facing direction from the facing vector, optionally rotated by center
     *   - Arc completion detection, snap, callback firing, state cleanup
     */
    protected updateCircleMovement(dt: number): void {
        const state = this.circleState;
        if (!state) return;

        if (state.angularVelocity <= 0) return;

        // --- Fade-in multiplier ---
        let fadeMul = 1;
        if (state.fadeInTime > 0 && state.elapsed < state.fadeInTime) {
            fadeMul = state.elapsed / state.fadeInTime;
        }

        // --- Angular step ---
        let angleStep = state.angularVelocity * dt * fadeMul;

        // --- Fade-out: ramp to 0 as remaining arc shrinks ---
        let completed = false;
        if (state.arcRad != null) {
            const remaining = state.arcRad - state.completedArcRad;
            if (remaining <= 0.0001) {
                completed = true;
                angleStep = 0;
            } else if (state.fadeOutTime > 0) {
                const fadeOutWindow = state.angularVelocity * state.fadeOutTime;
                if (remaining < fadeOutWindow) {
                    angleStep *= remaining / fadeOutWindow;
                }
            }
        }

        // --- Clamp to remaining arc ---
        if (state.arcRad != null && !completed) {
            const remaining = state.arcRad - state.completedArcRad;
            if (angleStep >= remaining) {
                angleStep = remaining;
                completed = true;
            }
        }

        // --- Apply step ---
        state.currentAngle += angleStep;
        state.completedArcRad += angleStep;
        state.elapsed += dt;

        // --- Get center position and orientation ---
        let centerX: number;
        let centerY: number;
        let centerOrientation = 0;
        if (state.center instanceof GameObject) {
            centerX = state.center.x;
            centerY = state.center.y;
            centerOrientation = state.center.orientation;
        } else {
            centerX = state.center.x;
            centerY = state.center.y;
        }

        // --- Compute offset from center ---
        const cosA = Math.cos(state.currentAngle);
        const sinA = Math.sin(state.currentAngle);

        let offsetX = state.radius * cosA;
        let offsetY = state.radius * sinA;

        // Rotate offset by centre's orientation so the orbit follows
        // the centre's local coordinate system
        if (centerOrientation !== 0) {
            const cosR = Math.cos(centerOrientation);
            const sinR = Math.sin(centerOrientation);
            const rx = offsetX * cosR - offsetY * sinR;
            const ry = offsetX * sinR + offsetY * cosR;
            offsetX = rx;
            offsetY = ry;
        }

        this.setLocation(centerX + offsetX, centerY + offsetY);

        // --- Compute facing direction ---
        // In the centre's local frame at angle θ:
        //   radial outward = (cosθ, sinθ)
        //   clockwise tangent = (sinθ, -cosθ)
        // The facing vector is interpreted as:
        //   facingX × tangent + facingY × radial
        const worldDirX = state.facingX * sinA + state.facingY * cosA;
        const worldDirY = state.facingX * (-cosA) + state.facingY * sinA;

        // Rotate facing by centre's orientation
        let dirX: number;
        let dirY: number;
        if (centerOrientation !== 0) {
            const cosR = Math.cos(centerOrientation);
            const sinR = Math.sin(centerOrientation);
            dirX = worldDirX * cosR - worldDirY * sinR;
            dirY = worldDirX * sinR + worldDirY * cosR;
        } else {
            dirX = worldDirX;
            dirY = worldDirY;
        }

        const norm = Math.sqrt(dirX * dirX + dirY * dirY);
        if (norm > 0.0001) {
            // setOrientationRadians expects 0 = up; atan2 gives 0 = right
            this.setOrientationRadians(Math.atan2(dirY, dirX) + Math.PI / 2);
        }

        // --- Arc completion ---
        if (completed) {
            const cb = state.onComplete;
            this.circleState = null;
            cb?.();
        }
    }

    takeDamage(amount : number) {
        this.hitpoints -= amount;
        if(this.hitpoints <= 0) {
            this.destroy();
        }
    }

    onDestroy(work : ()=>void) {
        this.onDestroyWork = work;
    }

    destroy() {
        if(this.onDestroyWork) {
            this.onDestroyWork();
        }
        this.gameclass.destroy(this);
    }

    /**
     * Internal function to handle drawing
     */
    draw(ctx : CanvasRenderingContext2D, offsetX : number, offsetY : number) {
        ctx.save();
        /* Put it in the right place */
        ctx.translate(this.x - offsetX, this.y - offsetY);

        /* Align sprite forward vector with facing direction */
        {
            const fwd = this.spriteForwardVector;
            const facing_norm = Math.sqrt(
                this.direction_x * this.direction_x +
                this.direction_y * this.direction_y
            );
            const facingX = facing_norm > 0 ? this.direction_x / facing_norm : fwd[0];
            const facingY = facing_norm > 0 ? this.direction_y / facing_norm : fwd[1];

            const rawAngle = Math.atan2(
                fwd[0] * facingY - fwd[1] * facingX,
                fwd[0] * facingX + fwd[1] * facingY
            );

            if (this.mirrorOnDirection && Math.abs(rawAngle) > Math.PI / 2) {
                ctx.scale(-1, 1);
                const mirrorAngle = -Math.atan2(
                    -fwd[0] * facingY - fwd[1] * facingX,
                    -fwd[0] * facingX + fwd[1] * facingY
                );
                ctx.rotate(mirrorAngle);
            } else {
                ctx.rotate(rawAngle);
            }
        }

        /* Grow In */
        if(this.growInMillis > 0 && this.timeExistedMillis < this.growInMillis) {
            const scale = Math.min(1, 0.05 + this.timeExistedMillis/this.growInMillis);
            ctx.scale(scale, scale);
        }

        /* Fade in */
        if(this.fadeInMillis > 0 && this.timeExistedMillis < this.fadeInMillis) {
            ctx.globalAlpha = Math.min(1, this.timeExistedMillis/this.fadeInMillis);
        }
        /* Fade out */
        if(this.fateOutMillis > 0 && this.timeExistedMillis >= (this.maxDurationMillis - this.fateOutMillis)) {
            ctx.globalAlpha = Math.max(0, Math.min(1, (this.maxDurationMillis - this.timeExistedMillis)/this.fateOutMillis));
        }
        /* Scale */
        if(this.width > 0 && this.height > 0)
            ctx.scale(this.width/this.gameclass.image.width, this.height/this.gameclass.image.height);

        ctx.drawImage(this.gameclass.image, -this.gameclass.image.width / 2, -this.gameclass.image.height / 2);
        ctx.restore();
    }

    onCollisionWith(other : GameObjectClass, work : (o:GameObject)=>void) {
        collisionActions.push(new CollisionAction((t:GameObject,o:GameObject)=>{work(o)}, null, this, other, null));
    }

    onCollisionWithParticular(other : GameObject, work : ()=>void) {
        collisionActions.push(new CollisionAction(work, null, this, null, other));
    }

    onCollisionWithEnemy(work : (o:GameObject)=>void) {
        collisionActions.push(new CollisionAction((t:GameObject,o:GameObject)=>{work(o)}, null, this, EnemyClass.rootEnemyClass, null));
    }
}

class AttachedGameObject {
    gameObject : GameObject
    offsetX : number;
    offsetY : number;
    orientationOffset : number;

    constructor(gameObject : GameObject, offsetX : number, offsetY : number, orientationOffset : number) {
        this.gameObject = gameObject;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.orientationOffset = orientationOffset;
    }

    update(parent : GameObject) {
        const cos = Math.cos(parent.orientation);
        const sin = Math.sin(parent.orientation);
        const rotatedX = this.offsetX * cos - this.offsetY * sin;
        const rotatedY = this.offsetX * sin + this.offsetY * cos;
        this.gameObject.x = parent.x + rotatedX;
        this.gameObject.y = parent.y + rotatedY;
        this.gameObject.orientation = parent.orientation + this.orientationOffset;
        this.gameObject.direction_x = Math.cos(this.gameObject.orientation - Math.PI/2);
        this.gameObject.direction_y = Math.sin(this.gameObject.orientation - Math.PI/2);
    }
}

export class PlayerClass extends GameObjectClass {
    static rootPlayerClass : PlayerClass = new PlayerClass("root", null);

    constructor(name : string, image_file : string|null) {
        super(name, image_file, PlayerClass.rootPlayerClass);
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
        // Circular orbit takes precedence over all other movement
        if (this.circleState) {
            this.updateCircleMovement(delta_t);
            this.updateAttached();
            return;
        }

        // Handle destination-based movement with deceleration (takes precedence over keyboard)
        if (this.destination) {
            const dx = this.destination.x - this.x;
            const dy = this.destination.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Check if reached destination (within 0.01 tolerance)
            if (distance <= 0.01) {
                this.x = this.destination.x;
                this.y = this.destination.y;
                this.x_speed = 0;
                this.y_speed = 0;
                this.velocity = 0;
                this.destination = null;
                if (this.onArrivalWork) {
                    this.onArrivalWork();
                }
                this.updateAttached();
                return;
            }

            // Apply deceleration if within decelerationDistance
            let speed = this.speed;
            if (distance <= this.decelerationDistance && this.velocity > 0) {
                const distanceRatio = distance / this.decelerationDistance;
                const deceleratedVelocity = this.velocity * distanceRatio;
                const minimumVelocity = this.velocity / this.decelerationTime;
                speed = Math.max(deceleratedVelocity, minimumVelocity);
            }

            // Calculate direction and apply velocity
            const norm = distance;
            this.x_speed = (dx / norm) * speed;
            this.y_speed = (dy / norm) * speed;

            // Prevent overshoot — snap to destination if step exceeds remaining distance
            if (delta_t * Math.min(speed, this.speed) >= distance) {
                this.x = this.destination.x;
                this.y = this.destination.y;
                this.x_speed = 0;
                this.y_speed = 0;
                this.velocity = 0;
                this.destination = null;
                if (this.onArrivalWork) {
                    this.onArrivalWork();
                }
                this.updateAttached();
                return;
            }
        }

        const normalized_x_speed = this.x_speed/this.speed;
        const normalized_y_speed = this.y_speed/this.speed;
        let norm = Math.sqrt(normalized_x_speed*normalized_x_speed + normalized_y_speed*normalized_y_speed);
        if(norm < 1)
            norm = 1;
        console.log(this.gameclass.name,  this.x, this.y, this.x_speed, this.y_speed, "norm:", norm, "delta_t:", delta_t);
         console.log("adding ", delta_t*(this.x_speed/norm), delta_t*(this.y_speed/norm));
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
        this.updateAttached();
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

    setSpeedX(speed : number) {
        this.x_speed = speed;
    }
    setSpeedY(speed : number) {
        this.y_speed = speed;
    }

    /**
     * Moves the player to the specified position in the given time.
     * Sets orientation to face the destination and calculates speed to arrive on schedule.
     * Deceleration is applied automatically when within decelerationDistance of destination.
     * This takes precedence over keyboard input.
     *
     * @param position - The target position to move to
     * @param time - The time in seconds to complete the movement
     * @example
     *   player.moveTo({x: 500, y: 300}, 2.0); // Moves to position over 2 seconds
     */
    moveTo(position: Position2D, time: number) {
        this.circleState = null;
        const dx = position.x - this.x;
        const dy = position.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        this.destination = position;
        this.setOrientationTowards(position);
        this.velocity = distance / time;
    }
}


export class EnemyClass extends GameObjectClass {
    static rootEnemyClass : EnemyClass = new EnemyClass("root", null);

    constructor(name : string, image_file : string|null, hitpoints : number = 1, parentClass? : EnemyClass) {
        super(name, image_file, parentClass || EnemyClass.rootEnemyClass, hitpoints);
    }

    spawn(x: number, y: number) : Enemy {
        if(!this.loaded) {
            console.log("Spawning before resource is loaded!");
        }
        const enemy = new Enemy(this, x, y);
        super.spawned(enemy);
        enemies.add(enemy);
        gameObjects.add(enemy);
        return enemy;
    }
}


export class Enemy extends GameObject {
    constructor(gameclass : EnemyClass, x : number, y : number) {
        super(gameclass, x, y);
    }

}

export class ProjectileClass extends GameObjectClass {
    static rootProjectileClass : ProjectileClass = new ProjectileClass("root", null);
    constructor(name : string, image_file : string|null) {
        super(name, image_file, ProjectileClass.rootProjectileClass);
    }

    spawn(x: number, y: number) : Projectile {
        const projectile = new Projectile(this, x, y);
        projectile.speed = this.defaultSpeed;
        projectiles.add(projectile);
        super.spawned(projectile);
        return projectile;
    }

    spawnAt(gameObject: GameObject) : Projectile {
        const projectile = new Projectile(this, gameObject.x, gameObject.y);
        projectile.setOrientationRadians(gameObject.orientation);
        projectile.speed = this.defaultSpeed;
        projectile.velocity = projectile.speed;
        projectiles.add(projectile);
        super.spawned(projectile);
        return projectile;
    }

    destroy(projectile : Projectile) {
        super.destroy(projectile);
        projectiles.delete(projectile);
    }
}

export class Projectile extends GameObject {
    alignToTravel: boolean = true;

    constructor(gameclass : ProjectileClass, x : number, y : number) {
        super(gameclass, x, y);
        this.destroyIfOffBoard = true;
        this.boundToBoard = false;
    }

    doMovement(delta_t: number): void {
        const prevX = this.x;
        const prevY = this.y;
        super.doMovement(delta_t);
        if (this.alignToTravel) {
            const dx = this.x - prevX;
            const dy = this.y - prevY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0.001) {
                this.direction_x = dx / dist;
                this.direction_y = dy / dist;
                this.orientation = Math.atan2(dy, dx) + Math.PI / 2;
            }
        }
    }

    destroy(): void {
        this.gameclass.destroy(this);
    }

}

export class ItemClass extends GameObjectClass {
    static rootItemClass : ItemClass = new ItemClass("root", null);
    constructor(name : string, image_file : string|null) {
        super(name, image_file, ItemClass.rootItemClass);
    }

    spawn(x: number, y: number) : Item {
        const item = new Item(this, x, y);
        items.add(item);
        gameObjects.add(item);
        super.spawned(item);
        return item;
    }

    spawnAt(gameObject: GameObject) : Item {
        const item = new Item(this, gameObject.x, gameObject.y);
        item.speed = this.defaultSpeed;
        item.velocity = item.speed;
        items.add(item);
        gameObjects.add(item);
        super.spawned(item);
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

export class EffectClass extends GameObjectClass {
    static rootEffectClass : EffectClass = new EffectClass("root", null);
    defaultDuration : number;
    defaultFadeIn : number;
    defaultFadeOut : number;
    constructor(name : string, image_file : string|null, duration : number = 1000, fadeIn : number = 0, fadeOut : number = 0) {
        super(name, image_file, EffectClass.rootEffectClass);
        this.defaultDuration = duration;
        this.defaultFadeIn = fadeIn;
        this.defaultFadeOut = fadeOut
    }

    spawnAt(gameObject : Position2D) : Effect {
        const effect = new Effect(this, gameObject.x, gameObject.y);
        effect.setMaxDuration(this.defaultDuration);
        effect.fadeInMillis = this.defaultFadeIn;
        effect.fateOutMillis = this.defaultFadeOut;
        this.spawned(effect);
        return effect;
    }

    spawn(x: number, y: number) : Effect {
        const effect = new Effect(this, x, y);
        effect.setMaxDuration(this.defaultDuration);
        effect.fadeInMillis = this.defaultFadeIn;
        effect.fateOutMillis = this.defaultFadeOut;
        this.spawned(effect);
        return effect;
    }
}

export class Effect extends GameObject {
    constructor(gameclass : EffectClass, x : number, y : number) {
        super(gameclass, x, y);
    }

    destroy(): void {
        super.destroy();
        gameObjects.delete(this);
    }
}

export class TextClass extends GameObjectClass {
    static rootTextClass : TextClass = new TextClass("root", null);
    constructor(name : string, image_file : string|null) {
        super(name, image_file, TextClass.rootTextClass);
    }

    spawnAt(text : string, pos : Position2D, inlineImages?: InlineImageMap) : Text {
        const t = new Text(this, text, pos.x, pos.y, inlineImages);
        t.text = text;
        this.spawned(t);
        return t;
    }


}
const textClass = new TextClass("root", null);
export function createText(text : string, pos : Position2D, inlineImages?: InlineImageMap) : Text {
    return textClass.spawnAt(text, pos, inlineImages);
}

interface ParsedSegment {
    type: "text" | "image";
    value: string;
}

function parseInlineText(text: string): ParsedSegment[] {
    const segments: ParsedSegment[] = [];
    const regex = /\{img:([a-zA-Z0-9_-]+)\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
        }
        segments.push({ type: "image", value: match[1] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        segments.push({ type: "text", value: text.slice(lastIndex) });
    }
    return segments;
}

export interface InlineImageDef {
    image: HTMLImageElement | string;
    width: number;
    height: number;
}

export type InlineImageMap = Record<string, InlineImageDef>;

const TRANSPARENT_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export class Text extends GameObject {
    text : string;
    size : number = 32;
    foreground : string = "white";
    highlightColor?: string;
    highlightPadding: number = 4;
    shadowColor?: string;
    shadowBlur: number = 4;
    shadowOffsetX: number = 2;
    shadowOffsetY: number = 2;
    textAlign: CanvasTextAlign = "left";
    inlineImages?: InlineImageMap;


    constructor(gameclass : TextClass, text:string, x : number, y : number, inlineImages?: InlineImageMap) {
        super(gameclass, x, y);
        this.text = text;
        if (inlineImages) {
            this.setInlineImages(inlineImages);
        }
    }

    setHighlight(color: string, padding?: number): void {
        this.highlightColor = color;
        if (padding != null) this.highlightPadding = padding;
    }

    setShadow(color: string, blur?: number, offsetX?: number, offsetY?: number): void {
        this.shadowColor = color;
        if (blur != null) this.shadowBlur = blur;
        if (offsetX != null) this.shadowOffsetX = offsetX;
        if (offsetY != null) this.shadowOffsetY = offsetY;
    }

    setTextAlign(align: CanvasTextAlign): void {
        this.textAlign = align;
    }

    setInlineImages(images: InlineImageMap): void {
        for (const name in images) {
            const def = images[name];
            if (typeof def.image === "string") {
                const img = new Image();
                const url = def.image;
                img.onload = () => { def.image = img; };
                img.onerror = () => {
                    console.error(`[Text] Failed to load inline image "${url}"`);
                    img.src = TRANSPARENT_GIF;
                    def.image = img;
                };
                img.src = url;
            }
        }
        this.inlineImages = images;
    }

    draw(ctx : CanvasRenderingContext2D, offsetX : number, offsetY : number) {
        ctx.save();
        ctx.font = this.size + "px Arial, Helvetica, sans-serif";
        ctx.translate(this.x - offsetX, this.y - offsetY);
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const segments = parseInlineText(this.text);

        // Compute total width for alignment
        let totalWidth = 0;
        for (const seg of segments) {
            if (seg.type === "text") {
                totalWidth += ctx.measureText(seg.value).width;
            } else if (seg.type === "image") {
                const def = this.inlineImages?.[seg.value];
                if (def) totalWidth += def.width;
            }
        }

        let xCursor = 0;
        if (this.textAlign === "center") xCursor = -totalWidth / 2;
        else if (this.textAlign === "right") xCursor = -totalWidth;

        for (const seg of segments) {
            if (seg.type === "text") {
                const metrics = ctx.measureText(seg.value);
                const textWidth = metrics.width;
                const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

                if (this.highlightColor) {
                    ctx.fillStyle = this.highlightColor;
                    const hx = xCursor - metrics.actualBoundingBoxLeft - this.highlightPadding;
                    const hy = -metrics.actualBoundingBoxAscent - this.highlightPadding;
                    ctx.fillRect(hx, hy, textWidth + this.highlightPadding * 2, textHeight + this.highlightPadding * 2);
                }

                if (this.shadowColor) {
                    ctx.shadowColor = this.shadowColor;
                    ctx.shadowBlur = this.shadowBlur;
                    ctx.shadowOffsetX = this.shadowOffsetX;
                    ctx.shadowOffsetY = this.shadowOffsetY;
                }

                ctx.fillStyle = this.foreground;
                ctx.fillText(seg.value, xCursor, 0);

                if (this.shadowColor) {
                    ctx.shadowColor = "transparent";
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                }

                xCursor += textWidth;

            } else if (seg.type === "image") {
                const def = this.inlineImages?.[seg.value];
                if (def) {
                    const img = def.image instanceof HTMLImageElement ? def.image : null;
                    if (img && img.complete && img.naturalWidth > 0) {
                        ctx.drawImage(img, xCursor, -def.height / 2, def.width, def.height);
                    }
                    xCursor += def.width;
                }
            }
        }

        ctx.restore();
    }
}


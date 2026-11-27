import { gameObjects, enemies, collisionActions, CollisionAction, boardWidth, boardHeight, players, projectiles, items } from "./simplegame";
import { dotProduct, type Position2D, type vec2 } from "./util";
import { TextEffectState, drawTextRunWithEffects, resolveTextEffects, type TextLabelEffectOptions } from "./text-effects";

export type {
    TextEffectOptions,
    TextLabelEffectOptions,
    TextShadowOptions,
    TextOutlineOptions,
    TextGlowOptions,
    TextBackgroundOptions,
} from "./text-effects";

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
 * @param direction - 1 = clockwise (default), -1 = counter-clockwise.
 *   Affects which way the arc is swept.
 * @param worldUp - Preferred world-space up direction during the orbit.
 *   Used by `"head-up"` and `"transform"` sprite alignment modes; ignored
 *   by `"rotate"`. Defaults to radially outward from the centre.
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
    direction?: number;
    worldUp?: vec2;
    onComplete?: () => void;
}

/**
 * A damage sprite: an alternate image to show when the object's HP drops
 * below a threshold. Sprites are sorted by hpThreshold ascending; the
 * engine draws the sprite with the smallest threshold that is >= the
 * current HP (clamped to defaultHitpoints).
 */
export type DamageSpriteDef = {
    hpThreshold: number;
    image: HTMLImageElement;
    loaded: boolean;
};

/**
 * Determines how a sprite's local image frame is mapped onto its world-space
 * facing direction.
 *
 * - `"head-up"` — rotation plus optional reflection. `worldUpVector` selects
 *   the reflection parity, stabilised by hysteresis. Shape-preserving.
 * - `"rotate"` — pure rotation based only on `spriteForwardVector`.
 *   `spriteUpVector` and `worldUpVector` are ignored. Shape-preserving.
 * - `"transform"` — legacy independent-axis mapping of forward and up. May
 *   shear and non-uniformly scale the sprite. This is an opt-in effects mode.
 */
export type SpriteAlignmentMode = "head-up" | "rotate" | "transform";

/** Default half-width, in degrees, of the `"head-up"` reflection deadband. */
const DEFAULT_SPRITE_REFLECTION_HYSTERESIS_DEG: number = 6;

/**
 * Returns the signed rotation angle that maps a sprite's forward vector onto
 * the object's facing direction.
 *
 * The angle uses canvas/screen coordinates and is suitable for
 * `CanvasRenderingContext2D.rotate()`.
 *
 * @param forward - The raw sprite image's forward direction
 * @param facingX - X component of the object's world-space facing direction
 * @param facingY - Y component of the object's world-space facing direction
 * @returns The rotation angle in radians, or 0 when the forward vector is
 *   zero-length or invalid
 */
function computeSpriteRotationAngle(
    forward: vec2,
    facingX: number,
    facingY: number
): number {
    const forwardLengthSquared =
        forward[0] * forward[0] + forward[1] * forward[1];

    if (!Number.isFinite(forwardLengthSquared) || forwardLengthSquared < 0.000001) {
        return 0;
    }

    return Math.atan2(
        forward[0] * facingY - forward[1] * facingX,
        forward[0] * facingX + forward[1] * facingY
    );
}

/**
 * Rotates a 2D vector by the given angle using the standard canvas rotation
 * matrix.
 *
 * @param vector - The vector to rotate
 * @param angleRadians - Rotation angle in radians
 * @returns A new rotated vector
 */
function rotateVec2(vector: vec2, angleRadians: number): vec2 {
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);
    return [
        vector[0] * cos - vector[1] * sin,
        vector[0] * sin + vector[1] * cos
    ];
}

/**
 * Converts a reflection-hysteresis half-width in degrees to the equivalent
 * cosine margin used by the dot-product alignment test.
 *
 * Values are clamped to 0..89.9 degrees so the reflection state cannot become
 * permanently locked. Non-finite values fall back to the engine default.
 *
 * @param hysteresisDeg - Half-width of the reflection deadband in degrees
 * @returns The cosine margin, in the range 0..~0.999998
 */
function computeReflectionCosineMargin(hysteresisDeg: number): number {
    if (!Number.isFinite(hysteresisDeg)) {
        return Math.sin(
            DEFAULT_SPRITE_REFLECTION_HYSTERESIS_DEG * Math.PI / 180
        );
    }

    const clampedDegrees = Math.max(0, Math.min(89.9, hysteresisDeg));
    return Math.sin(clampedDegrees * Math.PI / 180);
}

/**
 * Reports whether a vector has finite components and a usable magnitude.
 *
 * @param vector - The vector to validate
 * @returns True when the vector is finite and non-zero
 */
function isValidVector(vector: vec2): boolean {
    if (!Number.isFinite(vector[0]) || !Number.isFinite(vector[1])) {
        return false;
    }

    return vector[0] * vector[0] + vector[1] * vector[1] > 0.000001;
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
    /** The "up" direction of the raw sprite image. Used for reflection parity in `"head-up"` mode and as an independent axis in `"transform"` mode. Defaults to [-1, 0] for the default forward vector. */
    defaultSpriteUpVector: vec2 = [-1, 0];
    /** Default sprite alignment mode for spawned instances. */
    defaultSpriteAlignmentMode: SpriteAlignmentMode = "head-up";
    /** Default reflection hysteresis half-width in degrees for spawned instances. */
    defaultSpriteReflectionHysteresisDeg: number = DEFAULT_SPRITE_REFLECTION_HYSTERESIS_DEG;
    /** Default value for singleCollisionOnly on spawned instances */
    defaultSingleCollisionOnly: boolean = false;

    /** Damage sprites: alternate images shown at low HP. Sorted by hpThreshold ascending. */
    damageSprites: DamageSpriteDef[] = [];

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

    /**
     * Adds a damage sprite to be shown when the object's HP drops below a threshold.
     * Sprites are checked in hpThreshold order (ascending); the sprite with the
     * smallest threshold that is >= the current HP is drawn.
     *
     * @param hpThreshold - Upper bound HP for this sprite. Shown when HP <= this value
     *   and HP is not also <= a lower threshold.
     * @param imageFile - URL of the damage sprite image
     * @example
     *   enemyClass.addDamageSprite(60, "enemy_damaged.png");
     *   enemyClass.addDamageSprite(20, "enemy_crit.png");
     */
    addDamageSprite(hpThreshold: number, imageFile: string): void {
        const img = new Image();
        const def: DamageSpriteDef = { hpThreshold, image: img, loaded: false };
        img.onload = () => { def.loaded = true; };
        img.onerror = () => { def.loaded = true; };
        img.src = imageFile;
        this.damageSprites.push(def);
        this.damageSprites.sort((a, b) => a.hpThreshold - b.hpThreshold);
    }

    /**
     * Returns the damage sprite image for a given HP value, or null if no
     * sprite matches (the base image should be used instead). HP is clamped
     * to defaultHitpoints so boosts over max HP don't skip the full-cover sprite.
     *
     * @param hp - The object's current hitpoints
     * @returns The matching damage sprite image, or null
     */
    getDamageSpriteImage(hp: number): HTMLImageElement | null {
        const effectiveHp = Math.min(hp, this.defaultHitpoints);
        for (const sprite of this.damageSprites) {
            if (effectiveHp <= sprite.hpThreshold) {
                return sprite.image;
            }
        }
        return null;
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

/** Controls when a content mutation invalidates its parent layout. */
export type LayoutInvalidationMode = "auto" | "always" | "never";

/** Options accepted by layout-aware setters. */
export type LayoutInvalidationOptions = {
    invalidateLayout?: LayoutInvalidationMode;
};

export class GameObject {
    hitpoints : number;
    x : number;
    y : number;
    width: number;
    height : number;

    /** Minimum layout width in the object's layout units. */
    layoutMinWidth?: number;
    /** Minimum layout height in the object's layout units. */
    layoutMinHeight?: number;
    /** Intrinsic width captured before the first layout-assigned resize. */
    layoutIntrinsicWidth?: number;
    /** Intrinsic height captured before the first layout-assigned resize. */
    layoutIntrinsicHeight?: number;
    /** Width most recently assigned by a layout container. */
    layoutAssignedWidth?: number;
    /** Height most recently assigned by a layout container. */
    layoutAssignedHeight?: number;
    /** Width constraint supplied by a parent layout container. */
    layoutAvailableWidth?: number;
    /** Height constraint supplied by a parent layout container. */
    layoutAvailableHeight?: number;

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
    direction_y : number = -1;

    /** The direction the raw sprite image faces. Inherited from class defaultSpriteForwardVector at spawn. [0, -1] = up, [1, 0] = right, etc. Drives rotation in every alignment mode. */
    spriteForwardVector: vec2 = [0, -1];
    /** The "up" direction of this instance's sprite image. Used for reflection parity in `"head-up"` mode and as an independent axis in `"transform"` mode; ignored by `"rotate"`. Copied from class defaultSpriteUpVector at spawn. */
    spriteUpVector: vec2 = [-1, 0];
    /** The world-space "up" direction for this object. In `"head-up"` mode it selects reflection parity; in `"transform"` mode it is the independent target for spriteUpVector; ignored by `"rotate"`. Movement functions set it automatically. Default [0, -1] = screen-up. */
    worldUpVector: vec2 = [0, -1];
    /** Per-instance sprite alignment mode. Copied from class defaultSpriteAlignmentMode at spawn. */
    spriteAlignmentMode: SpriteAlignmentMode = "head-up";
    /** Half-width in degrees of the reflection deadband used by `"head-up"` mode. 0 = flip immediately; larger values make the current reflection state stickier. Clamped to 0..89.9 when used. Copied from class defaultSpriteReflectionHysteresisDeg at spawn. */
    spriteReflectionHysteresisDeg: number = DEFAULT_SPRITE_REFLECTION_HYSTERESIS_DEG;
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
        startAngle: number;
        angularVelocity: number;
        direction: number;
        elapsed: number;
        facingX: number;
        facingY: number;
        fadeInTime: number;
        fadeOutTime: number;
        arcRad: number | null;
        completedArcRad: number;
        customWorldUp: vec2 | null;
        onComplete: (() => void) | null;
    } | null = null;

    boundToBoard : boolean = false;

    destroyIfOffBoard : boolean = false;

    standardMovement : boolean = true;

    /** When true, movement methods (moveTo, circleAround) will not change the object's orientation. Default false. Useful for tools, projectiles with fixed sprite angle, etc. */
    lockOrientation : boolean = false;

    /** Whether this object can be resized by parent layout containers */
    layoutCanResizeMe : boolean = true;
    /** Whether this object should be maximized in the x direction within its container */
    maximizeX : boolean = false;
    /** Whether this object should be maximized in the y direction within its container */
    maximizeY : boolean = false;

    /** The object this is attached to, if any */
    attachedTo : GameObject|null = null;

    /** True after destroy() has started. Makes destroy() idempotent. */
    destroyed: boolean = false;

    /**
     * When true, destroy() destroys attached children instead of only detaching
     * them. Layout containers and page roots set this to true.
     */
    destroyAttachedOnDestroy: boolean = false;

    /** Whether this object is visible and interactive. Hiding a container hides all attached children via ancestor-chain checks in the engine. */
    visible: boolean = true;

    /** Opacity multiplier (0–1) for rendering. 1 = fully opaque (default — skipped for performance). */
    opacity: number = 1;

    /** Draw order. Lower values draw first (behind), higher values draw on top. Same-index objects preserve insertion order. Default 0. */
    zIndex: number = 0;

    /** When `true` the object is positioned in canvas-pixel (screen) coordinates instead of board coordinates. It stays fixed on screen regardless of camera movement, zoom, or panning. */
    hud: boolean = false;

    drawOverlay: ((ctx: CanvasRenderingContext2D) => void) | null = null;

    private progressBarGetter: (() => number) | null = null;
    private progressBarFgColor: string = '#00ff00';
    private progressBarOutlineColor: string = '#ffffff';
    private progressBarOpacity: number = 1.0;
    private progressBarHeight: number = 6;

    /** Whether the current `"head-up"` transform is reflected across the forward axis. */
    private spriteReflectionFlipped: boolean = false;
    /** Whether spriteReflectionFlipped has been initialised from a real alignment sample. */
    private spriteReflectionInitialized: boolean = false;
    /** Alignment mode used on the previous draw, for automatic reflection-state reset. */
    private lastSpriteAlignmentModeUsed: SpriteAlignmentMode | null = null;

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
    /** @deprecated Misspelled — use fadeOutMillis instead */
    fateOutMillis : number = 0;
    /** Fade-out duration in ms. Takes precedence over fateOutMillis. */
    fadeOutMillis : number = 0;
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
        this.direction_x = Math.cos(this.orientation - Math.PI / 2);
        this.direction_y = Math.sin(this.orientation - Math.PI / 2);

        this.speed = gameclass.defaultSpeed;
        this.spriteForwardVector = [...gameclass.defaultSpriteForwardVector];
        this.spriteUpVector = [...gameclass.defaultSpriteUpVector];
        this.spriteAlignmentMode = gameclass.defaultSpriteAlignmentMode;
        this.spriteReflectionHysteresisDeg =
            gameclass.defaultSpriteReflectionHysteresisDeg;
        this.singleCollisionOnly = gameclass.defaultSingleCollisionOnly;
    }

    /**
     * Marks the nearest layout ancestors dirty so they reflow before drawing.
     *
     * Layout containers override this to set their own dirty flag and continue
     * propagating upward through `attachedTo`.
     */
    invalidateLayout(): void {
        this.attachedTo?.invalidateLayout();
    }

    /**
     * Returns the width this object contributes to layout.
     *
     * Base objects use their explicit `width`, raised to `layoutMinWidth` when
     * one is set. Text overrides this with measured content width.
     */
    getLayoutWidth(): number {
        this.refreshLayoutIntrinsicSize();
        return Math.max(
            this.layoutIntrinsicWidth ?? this.width,
            this.layoutMinWidth ?? 0
        );
    }

    /**
     * Returns the height this object contributes to layout.
     *
     * Base objects use their explicit `height`, raised to `layoutMinHeight` when
     * one is set. Text overrides this with measured content height.
     */
    getLayoutHeight(): number {
        this.refreshLayoutIntrinsicSize();
        return Math.max(
            this.layoutIntrinsicHeight ?? this.height,
            this.layoutMinHeight ?? 0
        );
    }

    /**
     * Returns the width used when placing the object in a layout slot.
     *
     * Base objects use their current drawn width, which may differ from the
     * intrinsic layout width after a stretch or maximize assignment.
     */
    getLayoutVisualWidth(): number {
        this.refreshLayoutIntrinsicSize();
        return Math.max(this.width, this.layoutMinWidth ?? 0);
    }

    /**
     * Returns the height used when placing the object in a layout slot.
     *
     * Base objects use their current drawn height, which may differ from the
     * intrinsic layout height after a stretch or maximize assignment.
     */
    getLayoutVisualHeight(): number {
        this.refreshLayoutIntrinsicSize();
        return Math.max(this.height, this.layoutMinHeight ?? 0);
    }

    /**
     * Applies a width assigned by a parent layout container.
     *
     * The assigned width is clamped to the layout minimum and keeps a matching
     * hitbox in sync. Custom hitboxes that differed from the object size are
     * preserved.
     *
     * @param width - New layout width
     */
    setLayoutWidth(width: number): void {
        const oldWidth = this.width;
        const resolvedWidth = Math.max(width, this.layoutMinWidth ?? 0);
        this.width = resolvedWidth;
        this.layoutAssignedWidth = resolvedWidth;
        if (this.hitboxWidth === oldWidth) {
            this.hitboxWidth = resolvedWidth;
        }
    }

    /**
     * Applies a height assigned by a parent layout container.
     *
     * The assigned height is clamped to the layout minimum and keeps a matching
     * hitbox in sync. Custom hitboxes that differed from the object size are
     * preserved.
     *
     * @param height - New layout height
     */
    setLayoutHeight(height: number): void {
        const oldHeight = this.height;
        const resolvedHeight = Math.max(height, this.layoutMinHeight ?? 0);
        this.height = resolvedHeight;
        this.layoutAssignedHeight = resolvedHeight;
        if (this.hitboxHeight === oldHeight) {
            this.hitboxHeight = resolvedHeight;
        }
    }

    /**
     * Returns the horizontal offset from the object origin to its visual
     * layout centre. Base objects are already centre-anchored.
     */
    getLayoutOffsetX(): number {
        return 0;
    }

    /**
     * Returns the vertical offset from the object origin to its visual layout
     * centre. Base objects are already centre-anchored.
     */
    getLayoutOffsetY(): number {
        return 0;
    }

    /**
     * Applies a layout-assigned size and keeps a matching hitbox in sync.
     *
     * If the hitbox matched the previous width/height, it is resized with the
     * object. Custom hitboxes that differed from the object size are preserved.
     *
     * @param width - New layout width
     * @param height - New layout height
     */
    setLayoutSize(width: number, height: number): void {
        this.setLayoutWidth(width);
        this.setLayoutHeight(height);
    }

    /**
     * Captures the current width as the intrinsic width before a
     * layout-assigned resize.
     */
    captureLayoutIntrinsicWidth(): void {
        if (this.layoutIntrinsicWidth === undefined) {
            this.layoutIntrinsicWidth = this.width;
        }
    }

    /**
     * Captures the current height as the intrinsic height before a
     * layout-assigned resize.
     */
    captureLayoutIntrinsicHeight(): void {
        if (this.layoutIntrinsicHeight === undefined) {
            this.layoutIntrinsicHeight = this.height;
        }
    }

    /**
     * Clears all intrinsic and assigned size tracking. Call this after an
     * external or widget-internal resize that should become the new baseline.
     */
    clearLayoutIntrinsicSize(): void {
        this.layoutIntrinsicWidth = undefined;
        this.layoutIntrinsicHeight = undefined;
        this.layoutAssignedWidth = undefined;
        this.layoutAssignedHeight = undefined;
    }

    /**
     * Detects external size changes that happened after a layout assignment and
     * clears stale intrinsic values so they do not overwrite the new size.
     */
    refreshLayoutIntrinsicSize(): void {
        if (
            this.layoutIntrinsicWidth !== undefined &&
            this.layoutAssignedWidth !== undefined &&
            this.width !== this.layoutAssignedWidth
        ) {
            this.layoutIntrinsicWidth = undefined;
            this.layoutAssignedWidth = undefined;
        }
        if (
            this.layoutIntrinsicHeight !== undefined &&
            this.layoutAssignedHeight !== undefined &&
            this.height !== this.layoutAssignedHeight
        ) {
            this.layoutIntrinsicHeight = undefined;
            this.layoutAssignedHeight = undefined;
        }
    }

    /**
     * Restores any layout-assigned size back to the captured intrinsic size.
     * External changes detected through refreshLayoutIntrinsicSize() win over
     * stale captured values.
     */
    restoreLayoutIntrinsicSize(): void {
        this.refreshLayoutIntrinsicSize();
        if (
            this.layoutIntrinsicWidth !== undefined &&
            (this.layoutAssignedWidth === undefined ||
                this.width === this.layoutAssignedWidth)
        ) {
            this.setLayoutWidth(this.layoutIntrinsicWidth);
            this.layoutIntrinsicWidth = undefined;
            this.layoutAssignedWidth = undefined;
        }
        if (
            this.layoutIntrinsicHeight !== undefined &&
            (this.layoutAssignedHeight === undefined ||
                this.height === this.layoutAssignedHeight)
        ) {
            this.setLayoutHeight(this.layoutIntrinsicHeight);
            this.layoutIntrinsicHeight = undefined;
            this.layoutAssignedHeight = undefined;
        }
    }

    /**
     * Applies a width constraint supplied by a parent layout container.
     * Base objects ignore it; layout containers use it for nested reflow.
     *
     * @param width - Available width, or undefined to clear it
     */
    applyLayoutAvailableWidth(width: number | undefined): void {
        // Base game objects do not contain a nested layout.
    }

    /**
     * Applies a height constraint supplied by a parent layout container.
     * Base objects ignore it; layout containers use it for nested reflow.
     *
     * @param height - Available height, or undefined to clear it
     */
    applyLayoutAvailableHeight(height: number | undefined): void {
        // Base game objects do not contain a nested layout.
    }

    /**
     * Gives nested layout containers a chance to reflow before a parent
     * measures them. Base objects have no nested layout.
     */
    layoutForMeasurement(): void {
        // Base game objects do not contain a nested layout.
    }

    /**
     * Sets visibility and invalidates parent layout when the value changes.
     *
     * Layout containers skip invisible children. Direct assignment to `visible`
     * still works but does not invalidate layout automatically.
     *
     * @param visible - Whether this object should be visible
     */
    setVisible(visible: boolean): void {
        if (this.visible === visible) return;
        this.visible = visible;
        this.invalidateLayout();
    }

    /**
     * Sets a minimum width used by layout measurement.
     *
     * @param min - Minimum width in layout units, or null to clear it
     */
    setLayoutMinWidth(min: number | null): void {
        this.applyLayoutMutation(() => {
            this.layoutMinWidth = min ?? undefined;
        });
    }

    /**
     * Sets a minimum height used by layout measurement.
     *
     * @param min - Minimum height in layout units, or null to clear it
     */
    setLayoutMinHeight(min: number | null): void {
        this.applyLayoutMutation(() => {
            this.layoutMinHeight = min ?? undefined;
        });
    }

    /**
     * Applies a mutation and invalidates layout only when the effective layout
     * size changed.
     *
     * @param change - Mutation to apply
     * @param options - Invalidation override; defaults to automatic detection
     */
    protected applyLayoutMutation(
        change: () => void,
        options?: LayoutInvalidationOptions
    ): void {
        const oldWidth = this.getLayoutWidth();
        const oldHeight = this.getLayoutHeight();
        change();

        const mode = options?.invalidateLayout ?? "auto";
        if (mode === "always") {
            this.invalidateLayout();
            return;
        }
        if (mode === "never") {
            return;
        }
        if (
            oldWidth !== this.getLayoutWidth() ||
            oldHeight !== this.getLayoutHeight()
        ) {
            this.invalidateLayout();
        }
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

    /**
     * Attaches a progress bar drawn on this object.
     *
     * The bar is drawn in game (board) coordinates before the sprite
     * size-scale transform, centered 20 game units below the object's
     * origin, 80 % of the object's width wide.
     *
     * @param getter - Function returning the fill fraction (0–1), or `null` to hide the bar
     * @param fgColor - CSS colour string for the fill (e.g. `'#00ff00'`)
     * @param outlineColor - CSS colour string for the border (e.g. `'#ffffff'`)
     * @param opacity - Bar opacity 0–1 (multiplied with the object's own opacity)
     * @param height  - Bar height in game units (default 6)
     * @example
     *   healthBar.setProgressBar(
     *     () => this.hitpoints / this.maxHitpoints,
     *     '#00ff00',
     *     '#ffffff',
     *     0.9,
     *     8
     *   );
     */
    setProgressBar(getter: (() => number) | null, fgColor: string, outlineColor: string, opacity: number, height: number = 6): void {
        this.progressBarGetter = getter;
        this.progressBarFgColor = fgColor;
        this.progressBarOutlineColor = outlineColor;
        this.progressBarOpacity = opacity;
        this.progressBarHeight = height;
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
        this.attachedTo?.syncAttachOffset(this);
    }

    /**
     * Sets the new location of the object without any kind of movement, in absolute coordinatesr
     */
    setLocation(x : number, y : number) {
        this.x = x;
        this.y = y;
        this.updateAttached();
        this.attachedTo?.syncAttachOffset(this);
    }

    /**
     * Moves the object to the specified position in the given time.
     * Sets orientation to face the destination and calculates velocity to arrive on schedule.
     * Deceleration is applied automatically when within decelerationDistance of destination.
     *
     * @param position - The target position to move to
     * @param time - The time in seconds to complete the movement
     * @param up - Optional preferred world-space up direction for the object
     *   during this movement. Overrides {@link worldUpVector} (default
     *   [0, -1] = screen up). Used by `"head-up"` and `"transform"` alignment
     *   modes; ignored by `"rotate"`. Use [0, 1] for ceiling-walking, [1, 0]
     *   for wall-clinging on a right wall, etc.
     * @example
     *   enemy.moveTo({x: 1000, y: 500}, 3.0); // Moves to position over 3 seconds
     *   player.moveTo({x: 500, y: 0}, 2.0, [0, 1]); // Ceiling walk
     */
    moveTo(position: Position2D, time: number, up?: vec2) {
        if (up) this.worldUpVector = [up[0], up[1]];
        this.circleState = null;
        const dx = position.x - this.x;
        const dy = position.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        this.destination = position;
        if (distance > 0.001) {
            this.direction_x = dx / distance;
            this.direction_y = dy / distance;
            if (!this.lockOrientation) {
                this.orientation = Math.atan2(dy, dx) + Math.PI / 2;
            }
        }
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

        const rawArcRad = options.arcDeg != null
            ? options.arcDeg * Math.PI / 180
            : options.arcRad ?? null;
        const arcRad = rawArcRad != null ? Math.abs(rawArcRad) : null;

        const direction = options.direction != null ? (options.direction >= 0 ? 1 : -1) : 1;

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
            startAngle: startAngleRad,
            angularVelocity: options.velocity / options.radius,
            direction: options.direction ?? 1,
            elapsed: 0,
            facingX: normFacingX,
            facingY: normFacingY,
            fadeInTime: options.fadeInTime ?? 0,
            fadeOutTime: options.fadeOutTime ?? 0,
            arcRad: arcRad,
            completedArcRad: 0,
            customWorldUp: options.worldUp ? [options.worldUp[0], options.worldUp[1]] : null,
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
     * Updates the stored offset for an attached child from its current
     * position. Called after the child moves so parent movement preserves the
     * new relative placement.
     *
     * @param child - Attached child whose offset should be refreshed
     */
    syncAttachOffset(child: GameObject): void {
        for (const attached of this.attachedObjects) {
            if (attached.gameObject === child) {
                attached.offsetX = child.x - this.x;
                attached.offsetY = child.y - this.y;
            }
        }
    }

    /**
     * Detaches every currently attached object without destroying it.
     */
    detachAllAttachedObjects(): void {
        for (const attached of [...this.attachedObjects]) {
            this.detach(attached.gameObject);
        }
    }

    /**
     * Called by a child while it is being destroyed so the parent can remove it
     * from layout structures and reconcile ownership.
     *
     * Base objects only detach the child. Layout containers also remove it from
     * their `children` array.
     *
     * @param child - Child that is being destroyed
     */
    onChildDestroyed(child: GameObject): void {
        this.detach(child);
    }

    /**
     * Called after an attached parent has moved this object.
     *
     * Base objects do nothing. Layout containers update their own attached
     * children, making parent movement propagate through the attachment tree.
     */
    onAttachedParentMoved(): void {
        // Base objects have no attached descendants to reposition.
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
            this.direction_x = dx / distance;
            this.direction_y = dy / distance;
            if (!this.lockOrientation) {
                this.orientation = Math.atan2(dy, dx) + Math.PI / 2;
            }

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

        // --- Angular step (positive magnitude) ---
        let angleStep = state.angularVelocity * dt * fadeMul;

        // --- Fade-out: ramp to 0 as remaining arc shrinks ---
        let completed = false;
        if (state.arcRad != null) {
            const totalArc = Math.abs(state.arcRad);
            const remaining = totalArc - state.completedArcRad;
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
            const totalArc = Math.abs(state.arcRad);
            const remaining = totalArc - state.completedArcRad;
            if (angleStep >= remaining) {
                angleStep = remaining;
                completed = true;
            }
        }

        // --- Apply step (direction-aware) ---
        state.currentAngle += angleStep * state.direction;
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

        // --- Set world up direction ---
        if (state.customWorldUp) {
            this.worldUpVector[0] = state.customWorldUp[0];
            this.worldUpVector[1] = state.customWorldUp[1];
        } else if (state.radius > 0.001) {
            // Default: radially outward from the centre (centrifugal)
            this.worldUpVector[0] = offsetX / state.radius;
            this.worldUpVector[1] = offsetY / state.radius;
        }

        // --- Compute facing direction ---
        // In the centre's local frame at angle θ:
        //   radial outward = (cosθ, sinθ)
        //   tangent = direction * (sinθ, -cosθ)  (CW=+, CCW=-)
        // The facing vector is interpreted as:
        //   facingX × tangent + facingY × radial
        const worldDirX = state.facingX * sinA * state.direction + state.facingY * cosA;
        const worldDirY = state.facingX * (-cosA) * state.direction + state.facingY * sinA;

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
        if (norm > 0.0001 && !this.lockOrientation) {
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
        if (this.destroyed) return;
        this.destroyed = true;

        if(this.onDestroyWork) {
            this.onDestroyWork();
        }

        const attached = [...this.attachedObjects];
        if (this.destroyAttachedOnDestroy) {
            for (const child of attached) {
                child.gameObject.destroy();
            }
        } else {
            for (const child of attached) {
                this.detach(child.gameObject);
            }
        }

        const parent = this.attachedTo;
        if (parent) {
            parent.onChildDestroyed(this);
            this.attachedTo = null;
        }
        this.attachedObjects.length = 0;

        this.gameclass.destroy(this);
    }

    /**
     * Clears the stored `"head-up"` reflection parity so the next draw chooses
     * it afresh from the current facing and world-up vectors.
     *
     * Call this after teleporting an object, changing its sprite art, or
     * changing `worldUpVector` discontinuously when the previous reflection
     * state should not carry over.
     */
    resetSpriteReflectionState(): void {
        this.spriteReflectionFlipped = false;
        this.spriteReflectionInitialized = false;
        this.lastSpriteAlignmentModeUsed = null;
    }

    /**
     * Resets the stored reflection state when the alignment mode has changed.
     * This prevents a stale mirror state from carrying between modes.
     */
    private resetSpriteReflectionStateIfModeChanged(): void {
        if (this.lastSpriteAlignmentModeUsed !== this.spriteAlignmentMode) {
            this.resetSpriteReflectionState();
            this.lastSpriteAlignmentModeUsed = this.spriteAlignmentMode;
        }
    }

    /**
     * Updates and returns the reflection parity used by `"head-up"` mode.
     *
     * The method compares the sprite's rotated up vector with the desired
     * world-up vector using a cosine margin derived from
     * `spriteReflectionHysteresisDeg`. If the vectors are invalid, reflection
     * is disabled and the mode degrades to pure rotation.
     *
     * @param rotatedUp - The sprite up vector after the facing rotation
     * @param worldUp - The object's desired world-space up direction
     * @returns True when the sprite should be reflected across its forward axis
     */
    private updateSpriteReflection(rotatedUp: vec2, worldUp: vec2): boolean {
        if (!isValidVector(rotatedUp) || !isValidVector(worldUp)) {
            this.spriteReflectionFlipped = false;
            this.spriteReflectionInitialized = false;
            return false;
        }

        const rotatedUpLengthSquared =
            rotatedUp[0] * rotatedUp[0] + rotatedUp[1] * rotatedUp[1];
        const worldUpLengthSquared =
            worldUp[0] * worldUp[0] + worldUp[1] * worldUp[1];
        const alignment =
            dotProduct(rotatedUp, worldUp) /
            Math.sqrt(rotatedUpLengthSquared * worldUpLengthSquared);

        if (!this.spriteReflectionInitialized) {
            this.spriteReflectionFlipped = alignment < 0;
            this.spriteReflectionInitialized = true;
            return this.spriteReflectionFlipped;
        }

        const margin = computeReflectionCosineMargin(
            this.spriteReflectionHysteresisDeg
        );

        if (!this.spriteReflectionFlipped && alignment < -margin) {
            this.spriteReflectionFlipped = true;
        } else if (this.spriteReflectionFlipped && alignment > margin) {
            this.spriteReflectionFlipped = false;
        }

        return this.spriteReflectionFlipped;
    }

    /**
     * Applies the selected sprite-alignment transform to the canvas context.
     *
     * Shape-preserving modes (`"head-up"` and `"rotate"`) use only rotation
     * and optional reflection. `"transform"` keeps the legacy independent-axis
     * mapping, which can shear and non-uniformly scale the sprite.
     *
     * @param ctx - The canvas context, already translated to the object origin
     */
    private applySpriteAlignmentTransform(ctx: CanvasRenderingContext2D): void {
        this.resetSpriteReflectionStateIfModeChanged();

        const facingX = Math.sin(this.orientation);
        const facingY = -Math.cos(this.orientation);

        if (this.spriteAlignmentMode === "transform") {
            const fwd = this.spriteForwardVector;
            const up = this.spriteUpVector;
            const wx = this.worldUpVector[0];
            const wy = this.worldUpVector[1];

            const det = fwd[0] * up[1] - fwd[1] * up[0];
            const worldUpInvalid =
                isNaN(wx) || isNaN(wy) || (wx === 0 && wy === 0);
            // If facing and worldUp are (anti)parallel the matrix rows are dependent.
            const facingCrossWorldUp = Math.abs(facingX * wy - facingY * wx);

            if (Math.abs(det) < 0.001 || worldUpInvalid || facingCrossWorldUp < 0.001) {
                // Sprite frame is degenerate, world-up is invalid, or facing
                // and world-up are (anti)parallel — fall back to a simple
                // rotation so the sprite at least faces the right direction.
                ctx.rotate(
                    computeSpriteRotationAngle(fwd, facingX, facingY)
                );
            } else {
                // M is the 2×2 matrix that maps the sprite's forward vector
                // to the facing direction and the sprite's up vector to the
                // object's worldUpVector.
                //
                //   M · fwd  = (facingX, facingY)
                //   M · up   = (wx, wy)
                //
                // Solved via Cramer's rule. This is the legacy opt-in mode and
                // may shear or non-uniformly scale the sprite.
                ctx.transform(
                    (facingX * up[1] - wx * fwd[1]) / det,
                    (facingY * up[1] - wy * fwd[1]) / det,
                    (fwd[0] * wx - up[0] * facingX) / det,
                    (fwd[0] * wy - up[0] * facingY) / det,
                    0, 0
                );
            }
            return;
        }

        const rotationAngle = computeSpriteRotationAngle(
            this.spriteForwardVector,
            facingX,
            facingY
        );
        ctx.rotate(rotationAngle);

        if (this.spriteAlignmentMode !== "rotate") {
            const rotatedUp = rotateVec2(this.spriteUpVector, rotationAngle);
            if (this.updateSpriteReflection(rotatedUp, this.worldUpVector)) {
                // Reflect across the local forward axis. This leaves the
                // facing direction unchanged and only flips which side of the
                // sprite is considered up.
                ctx.scale(1, -1);
            }
        }
    }

    /**
     * Internal function to handle drawing
     */
    draw(ctx : CanvasRenderingContext2D, offsetX : number, offsetY : number) {
        ctx.save();
        /* Put it in the right place */
        ctx.translate(this.x - offsetX, this.y - offsetY);

        /* Align the sprite's local frame with its world-space facing */
        this.applySpriteAlignmentTransform(ctx);

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
        {
            const effectiveFadeOut = this.fadeOutMillis !== 0 ? this.fadeOutMillis : this.fateOutMillis;
            if(effectiveFadeOut > 0 && this.timeExistedMillis >= (this.maxDurationMillis - effectiveFadeOut)) {
                ctx.globalAlpha = Math.max(0, Math.min(1, (this.maxDurationMillis - this.timeExistedMillis)/effectiveFadeOut));
            }
        }
        /* Opacity */
        if (this.opacity < 1) {
            ctx.globalAlpha *= this.opacity;
        }

        /* Progress bar — in game/board units, before the sprite size-scale transform */
        if (this.progressBarGetter !== null) {
            ctx.save();
            ctx.globalAlpha = this.progressBarOpacity * (this.opacity < 1 ? this.opacity : 1);
            const barW = this.width * 0.8;
            const barH = this.progressBarHeight;
            const barX = -barW / 2;
            const barY = this.height / 2 + 20;
            ctx.fillStyle = this.progressBarOutlineColor;
            ctx.fillRect(barX, barY, barW, barH);
            const value = Math.max(0, Math.min(1, this.progressBarGetter()));
            ctx.fillStyle = this.progressBarFgColor;
            ctx.fillRect(barX + 1, barY + 1, (barW - 2) * value, barH - 2);
            ctx.restore();
        }

        /* Scale */
        const effectiveImage = this.gameclass.getDamageSpriteImage(this.hitpoints) ?? this.gameclass.image;
        if(this.width > 0 && this.height > 0)
            ctx.scale(this.width/effectiveImage.width, this.height/effectiveImage.height);

        ctx.drawImage(effectiveImage, -effectiveImage.width / 2, -effectiveImage.height / 2);

        if (this.drawOverlay !== null) {
            this.drawOverlay(ctx);
        }

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
        this.gameObject.onAttachedParentMoved();
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
     * @param up - Optional world-space up direction (see {@link GameObject.moveTo}).
     * @example
     *   player.moveTo({x: 500, y: 300}, 2.0); // Moves to position over 2 seconds
     */
    moveTo(position: Position2D, time: number, up?: vec2) {
        if (up) this.worldUpVector = [up[0], up[1]];
        this.circleState = null;
        const dx = position.x - this.x;
        const dy = position.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        this.destination = position;
        if (distance > 0.001) {
            this.direction_x = dx / distance;
            this.direction_y = dy / distance;
            if (!this.lockOrientation) {
                this.orientation = Math.atan2(dy, dx) + Math.PI / 2;
            }
        }
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
        super.destroy();
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
        super.destroy();
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

type MeasuredTextSegment =
    | {
        type: "text";
        value: string;
        width: number;
        ascent: number;
        descent: number;
        left: number;
    }
    | {
        type: "image";
        def: InlineImageDef;
        width: number;
        height: number;
    };

type TextMeasurement = {
    width: number;
    height: number;
    fontHeight: number;
    segments: MeasuredTextSegment[];
};

const TRANSPARENT_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

let textMeasurementCanvas: HTMLCanvasElement | null = null;
let textMeasurementContext: CanvasRenderingContext2D | null = null;

/**
 * Returns a shared offscreen 2D context for text measurement.
 */
function getTextMeasurementContext(): CanvasRenderingContext2D | null {
    if (textMeasurementContext) return textMeasurementContext;
    if (typeof document === "undefined") return null;
    textMeasurementCanvas = document.createElement("canvas");
    textMeasurementContext = textMeasurementCanvas.getContext("2d");
    return textMeasurementContext;
}

/**
 * Releases the shared offscreen text measurement context.
 *
 * Called by engine teardown so a destroyed engine leaves no measurement
 * resources behind.
 */
export function resetTextMeasurementContext(): void {
    textMeasurementCanvas = null;
    textMeasurementContext = null;
}

export class Text extends GameObject {
    text : string;
    size : number = 32;
    foreground : string = "white";
    textAlign: CanvasTextAlign = "left";
    inlineImages?: InlineImageMap;

    /** Sample whose measured width is reserved as a layout minimum. */
    layoutMinWidthSample?: string;
    /** Sample whose measured height is reserved as a layout minimum. */
    layoutMinHeightSample?: string;

    private measurementCache?: {
        signature: string;
        measurement: TextMeasurement;
    };

    private sampleMeasurementCache?: {
        signature: string;
        measurement: TextMeasurement;
    };

    private readonly textEffectState = new TextEffectState();

    /**
     * @deprecated Use `setTextEffects({ background: { color } })` or
     * `setHighlight()` instead.
     */
    get highlightColor(): string | undefined {
        return this.textEffectState.getBackgroundColor();
    }

    set highlightColor(color: string | undefined) {
        this.textEffectState.setBackgroundColor(color);
    }

    /**
     * @deprecated Use `setTextEffects({ background: { padding } })` or
     * `setHighlight()` instead.
     */
    get highlightPadding(): number {
        return this.textEffectState.getBackgroundPadding();
    }

    set highlightPadding(padding: number) {
        this.textEffectState.setBackgroundPadding(padding);
    }

    /**
     * @deprecated Use `setTextEffects({ shadow: { color } })` or
     * `setShadow()` instead.
     */
    get shadowColor(): string | undefined {
        return this.textEffectState.getShadowColor();
    }

    set shadowColor(color: string | undefined) {
        this.textEffectState.setShadowColor(color);
    }

    /**
     * @deprecated Use `setTextEffects({ shadow: { blur } })` or
     * `setShadow()` instead.
     */
    get shadowBlur(): number {
        return this.textEffectState.getShadowBlur();
    }

    set shadowBlur(blur: number) {
        this.textEffectState.setShadowBlur(blur);
    }

    /**
     * @deprecated Use `setTextEffects({ shadow: { offsetX } })` or
     * `setShadow()` instead.
     */
    get shadowOffsetX(): number {
        return this.textEffectState.getShadowOffsetX();
    }

    set shadowOffsetX(offsetX: number) {
        this.textEffectState.setShadowOffsetX(offsetX);
    }

    /**
     * @deprecated Use `setTextEffects({ shadow: { offsetY } })` or
     * `setShadow()` instead.
     */
    get shadowOffsetY(): number {
        return this.textEffectState.getShadowOffsetY();
    }

    set shadowOffsetY(offsetY: number) {
        this.textEffectState.setShadowOffsetY(offsetY);
    }


    constructor(gameclass : TextClass, text:string, x : number, y : number, inlineImages?: InlineImageMap) {
        super(gameclass, x, y);
        this.text = text;
        if (inlineImages) {
            this.setInlineImages(inlineImages);
        }
    }

    /**
     * Replaces all text effects.
     *
     * Effects are paint-only and do not invalidate layout or change measured
     * text dimensions.
     *
     * @param options - New effect configuration; omit to clear all effects
     */
    setTextEffects(options?: TextLabelEffectOptions): void {
        this.textEffectState.setOptions(options);
    }

    /**
     * Clears all text effects, including the legacy highlight background.
     */
    clearTextEffects(): void {
        this.textEffectState.clear();
    }

    /**
     * Enables a rectangular background behind each text segment.
     *
     * Compatibility alias for `setTextEffects({ background: { color, padding } })`.
     *
     * @param color - Background color
     * @param padding - Optional padding around text segments
     */
    setHighlight(color: string, padding?: number): void {
        this.textEffectState.setBackgroundLegacy(color, padding);
    }

    /**
     * Enables a drop shadow.
     *
     * Compatibility alias for
     * `setTextEffects({ shadow: { color, blur, offsetX, offsetY } })`.
     *
     * @param color - Shadow color
     * @param blur - Optional blur radius
     * @param offsetX - Optional horizontal offset
     * @param offsetY - Optional vertical offset
     */
    setShadow(color: string, blur?: number, offsetX?: number, offsetY?: number): void {
        this.textEffectState.setShadowLegacy(color, blur, offsetX, offsetY);
    }

    setTextAlign(align: CanvasTextAlign): void {
        if (this.textAlign === align) return;
        this.textAlign = align;
        this.invalidateLayout();
    }

    /**
     * Updates the text and optionally invalidates layout when its measured
     * layout size changes.
     *
     * @param text - New text content
     * @param options - Invalidation override; defaults to automatic detection
     */
    setText(text: string, options?: LayoutInvalidationOptions): void {
        this.applyLayoutMutation(() => {
            this.text = text;
        }, options);
    }

    /**
     * Updates the font size and optionally invalidates layout when its measured
     * layout size changes.
     *
     * @param size - New font size in layout units
     * @param options - Invalidation override; defaults to automatic detection
     */
    setSize(size: number, options?: LayoutInvalidationOptions): void {
        if (!Number.isFinite(size) || size <= 0) return;
        this.applyLayoutMutation(() => {
            this.size = size;
        }, options);
    }

    /**
     * Sets a text sample whose measured width becomes the minimum layout width.
     *
     * @param sample - Text to measure, or null to clear the minimum
     */
    setLayoutMinWidthSample(sample: string | null): void {
        this.applyLayoutMutation(() => {
            this.layoutMinWidthSample = sample ?? undefined;
        });
    }

    /**
     * Sets a text sample whose measured height becomes the minimum layout height.
     *
     * @param sample - Text to measure, or null to clear the minimum
     */
    setLayoutMinHeightSample(sample: string | null): void {
        this.applyLayoutMutation(() => {
            this.layoutMinHeightSample = sample ?? undefined;
        });
    }

    setInlineImages(images: InlineImageMap, options?: LayoutInvalidationOptions): void {
        this.applyLayoutMutation(() => {
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
        }, options);
        this.measurementCache = undefined;
        this.sampleMeasurementCache = undefined;
    }

    /**
     * Returns the font string used by both drawing and measurement.
     */
    private getFontString(): string {
        return this.size + "px Arial, Helvetica, sans-serif";
    }

    private getMeasurementContext(): CanvasRenderingContext2D | null {
        return getTextMeasurementContext();
    }

    /**
     * Builds a cache key from all fields that affect measured text dimensions.
     */
    private getMeasurementSignature(): string {
        let inlineSignature = "";
        if (this.inlineImages) {
            for (const name in this.inlineImages) {
                const def = this.inlineImages[name];
                const image = def.image;
                const imageIdentity = typeof image === "string"
                    ? image
                    : `${image.src}:${image.complete}:${image.naturalWidth}`;
                inlineSignature +=
                    `${name}:${def.width}:${def.height}:${imageIdentity};`;
            }
        }
        return `${this.size}\u0000${this.text}\u0000${inlineSignature}`;
    }

    /**
     * Measures the given text string using the current font and inline images.
     */
    private measureFromText(text: string): TextMeasurement {
        const ctx = this.getMeasurementContext();
        if (!ctx) {
            return {
                width: 0,
                height: this.size,
                fontHeight: this.size,
                segments: [],
            };
        }

        ctx.font = this.getFontString();
        const fontMetrics = ctx.measureText("Mg");
        const fontHeight =
            ((fontMetrics.fontBoundingBoxAscent ?? 0) +
                (fontMetrics.fontBoundingBoxDescent ?? 0)) || this.size;

        const segments: MeasuredTextSegment[] = [];
        let width = 0;
        let height = fontHeight;

        for (const parsed of parseInlineText(text)) {
            if (parsed.type === "text") {
                const metrics = ctx.measureText(parsed.value);
                const segmentWidth = metrics.width;
                const ascent = metrics.actualBoundingBoxAscent ?? 0;
                const descent = metrics.actualBoundingBoxDescent ?? 0;
                segments.push({
                    type: "text",
                    value: parsed.value,
                    width: segmentWidth,
                    ascent: ascent,
                    descent: descent,
                    left: metrics.actualBoundingBoxLeft ?? 0,
                });
                width += segmentWidth;
            } else {
                const def = this.inlineImages?.[parsed.value];
                if (def) {
                    segments.push({
                        type: "image",
                        def: def,
                        width: def.width,
                        height: def.height,
                    });
                    width += def.width;
                    height = Math.max(height, def.height);
                }
            }
        }

        return {
            width: width,
            height: height,
            fontHeight: fontHeight,
            segments: segments,
        };
    }

    /**
     * Returns cached measurement for the current text, if the signature matches.
     */
    private measureTextLayout(): TextMeasurement {
        const signature = this.getMeasurementSignature();
        if (this.measurementCache?.signature === signature) {
            return this.measurementCache.measurement;
        }
        const measurement = this.measureFromText(this.text);
        if (this.getMeasurementContext()) {
            this.measurementCache = { signature, measurement };
        }
        return measurement;
    }

    /**
     * Returns cached measurement for a minimum-size sample.
     */
    private measureSample(text: string): TextMeasurement {
        const signature =
            this.getMeasurementSignature() + "\u0000sample\u0000" + text;
        if (this.sampleMeasurementCache?.signature === signature) {
            return this.sampleMeasurementCache.measurement;
        }
        const measurement = this.measureFromText(text);
        if (this.getMeasurementContext()) {
            this.sampleMeasurementCache = { signature, measurement };
        }
        return measurement;
    }

    /**
     * Returns effective layout width including numeric and sample minimums.
     */
    override getLayoutWidth(): number {
        const measured = this.measureTextLayout().width;
        const sampleWidth = this.layoutMinWidthSample
            ? this.measureSample(this.layoutMinWidthSample).width
            : 0;
        return Math.max(measured, this.layoutMinWidth ?? 0, sampleWidth);
    }

    /**
     * Returns effective layout height including numeric and sample minimums.
     */
    override getLayoutHeight(): number {
        const measured = this.measureTextLayout().height;
        const sampleHeight = this.layoutMinHeightSample
            ? this.measureSample(this.layoutMinHeightSample).height
            : 0;
        return Math.max(measured, this.layoutMinHeight ?? 0, sampleHeight);
    }

    override getLayoutVisualWidth(): number {
        return this.getLayoutWidth();
    }

    override getLayoutVisualHeight(): number {
        return this.getLayoutHeight();
    }

    /**
     * Returns the offset from the text origin to its layout centre.
     */
    override getLayoutOffsetX(): number {
        const width = this.getLayoutWidth();
        if (this.textAlign === "center") return 0;
        if (this.textAlign === "right") return -width / 2;
        return width / 2;
    }

    /**
     * Text is vertically centred on its draw origin.
     */
    override getLayoutOffsetY(): number {
        return 0;
    }

    draw(ctx : CanvasRenderingContext2D, offsetX : number, offsetY : number) {
        ctx.save();
        ctx.font = this.getFontString();
        ctx.translate(this.x - offsetX, this.y - offsetY);
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        /* Opacity */
        if (this.opacity < 1) {
            ctx.globalAlpha = this.opacity;
        }

        const measurement = this.measureTextLayout();
        const segments = measurement.segments;
        const totalWidth = measurement.width;
        const paint = resolveTextEffects(
            ctx,
            this.foreground,
            this.textEffectState.getOptions()
        );

        let xCursor = 0;
        if (this.textAlign === "center") xCursor = -totalWidth / 2;
        else if (this.textAlign === "right") xCursor = -totalWidth;

        for (const seg of segments) {
            if (seg.type === "text") {
                if (paint.background) {
                    ctx.fillStyle = paint.background.color;
                    const hx = xCursor - seg.left - paint.background.padding;
                    const hy = -seg.ascent - paint.background.padding;
                    ctx.fillRect(
                        hx,
                        hy,
                        seg.width + paint.background.padding * 2,
                        seg.ascent + seg.descent + paint.background.padding * 2
                    );
                }

                drawTextRunWithEffects(
                    ctx,
                    seg.value,
                    xCursor,
                    0,
                    this.foreground,
                    paint
                );

                xCursor += seg.width;

            } else if (seg.type === "image") {
                const img = seg.def.image instanceof HTMLImageElement ? seg.def.image : null;
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.drawImage(
                        img,
                        xCursor,
                        -seg.def.height / 2,
                        seg.def.width,
                        seg.def.height
                    );
                }
                xCursor += seg.def.width;
            }
        }

        ctx.restore();
    }
}


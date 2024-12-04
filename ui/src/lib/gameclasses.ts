import { gameObjects, enemies, collisionActions, CollisionAction, boardWidth, boardHeight, players, projectiles, items } from "./simplegame";
import type { Position2D } from "./util";

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

    constructor(name : string, image_file : string|null, parent : GameObjectClass, hitpoints : number = 1) {
        this.name = name;
        this.defaultHitpoints = hitpoints;
        if(image_file) {
            this.image = new Image();
            this.image.onload = () => {
                this.defaultWidth = this.image.width;
                this.defaultHeight = this.image.height;
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
    }

    /**
     * Sets the maximum duration in milliseconds
     */
    setMaxDuration(millis : number) {
        this.maxDurationMillis = millis;
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

    setOrientationTowards(pos : Position2D) {
        const dx = pos.x - this.x;
        const dy = pos.y - this.y;
        this.orientation = Math.atan2(dy, dx) + Math.PI/2;
        // debug("Setting orientation towards " + pos.x + ", " + pos.y + " from " + this.x + ", " + this.y + " to " + this.orientation);
        this.direction_x = Math.cos(this.orientation - Math.PI/2);
        this.direction_y = Math.sin(this.orientation - Math.PI/2);
    }

    move(speed : number) {
        this.velocity = speed;
    }

    /**
     * Internal function to move the object
     */
    doMovement(delta_t : number) {
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
    draw(ctx : CanvasRenderingContext2D) {
        ctx.save();
        /* Put it in the right place */
        ctx.translate(this.x, this.y);
        ctx.rotate(this.orientation);

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
    constructor(gameclass : ProjectileClass, x : number, y : number) {
        super(gameclass, x, y);
        this.destroyIfOffBoard = true;
        this.boundToBoard = false;
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

    spawnAt(text : string, pos : Position2D) : Text {
        const t = new Text(this, text, pos.x, pos.y);
        t.text = text;
        this.spawned(t);
        return t;
    }


}
const textClass = new TextClass("root", null);
export function createText(text : string, pos : Position2D) : Text {
    return textClass.spawnAt(text, pos);
}

export class Text extends GameObject {
    text : string;
    size : number = 32;
    foreground : string = "white";
    background : string = "black";
    

    constructor(gameclass : TextClass, text:string, x : number, y : number) {
        super(gameclass, x, y);
        this.text = text;
    }

    draw(ctx : CanvasRenderingContext2D) {
        console.log("Drawing text", this.text);
        ctx.save();
        ctx.font = this.size + "px Arial, Helvetica, sans-serif";
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.background;
        ctx.fillText(this.text, 0, 0);
        ctx.fillStyle = this.foreground;
        ctx.fillText(this.text, -1, -1);
        ctx.restore();
    }
}


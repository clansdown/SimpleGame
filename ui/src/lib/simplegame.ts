/* The game engine library */

let ticksPerSecond = 20;
let canvas: HTMLCanvasElement;
let lastGameLoopTime : number;

let players : Player[] = [];
let enemies : Enemy[] = [];
let projectiles : Projectile[] = [];
let items : Item[] = [];

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
    orientation : number;
    gameclass : GameObjectClass;
    constructor(gameclass : GameObjectClass, x : number, y : number) {
        this.gameclass = gameclass;
        this.x = x;
        this.y = y;
        this.orientation = 0;
    }

    draw(ctx : CanvasRenderingContext2D) {
        ctx.save();
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
        return player;
    }
}

export class Player extends GameObject {
    constructor(gameclass : PlayerClass, x : number, y : number) {
        super(gameclass, x, y);
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



export function initEngine(screenCanvas: HTMLCanvasElement) {
    canvas = screenCanvas;


    lastGameLoopTime = Date.now();
    mainGameLoop();
}

export function loadEnemy(name : string, image_file : string) : EnemyClass {
    const enemy = new EnemyClass(name, image_file);



    return enemy;
}


function mainGameLoop() {
    const start_time = Date.now();
    const delta_t = start_time - lastGameLoopTime;
    lastGameLoopTime = start_time;

    // User Input

    // Move the objects

    // Detect Collisions

    // Take tick actions

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




}



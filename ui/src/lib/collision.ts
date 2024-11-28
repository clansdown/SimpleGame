/* Collision detection related code */

import type { GameObject } from "./simplegame";
import { applyMatrixToBox, generate_rotation_matrix, multiplyMatrixVector, transpose_matrix, type box2, type matrix2 } from "./util";

class CollisionObject {
    /** The actual hitbox in 2-space */
    hitbox : box2;

    /** Used by collision detection */
    rotationMatrix : matrix2;
    
    object : GameObject;

    constructor(o : GameObject) {
        this.object = o;
        const rotation_matrix = generate_rotation_matrix(o.orientation);
        const topLeft = multiplyMatrixVector(rotation_matrix, [o.x - o.hitboxWidth / 2, o.y + o.hitboxHeight / 2]);
        const topRight = multiplyMatrixVector(rotation_matrix, [o.x + o.hitboxWidth / 2, o.y + o.hitboxHeight / 2]);
        const bottomLeft = multiplyMatrixVector(rotation_matrix, [o.x - o.hitboxWidth / 2, o.y - o.hitboxHeight / 2]);
        const bottomRight = multiplyMatrixVector(rotation_matrix, [o.x + o.hitboxWidth / 2, o.y - o.hitboxHeight / 2]);
        this.hitbox = [
            o.x + topLeft[0] , o.y + topLeft[1], 
            o.x + topRight[0], o.y + topRight[1], 
            o.x + bottomRight[0], o.y + bottomRight[1], 
            o.x + bottomLeft[0], o.y + bottomLeft[1], 
        ];
        this.rotationMatrix = rotation_matrix;
    }

}

class TreeNode {
    x : number;
    y : number;
    width : number;
    height : number;
    quadrantsAllocated : boolean = false;

    constructor(x : number, y : number, width : number, height : number) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    topLeft : TreeNode | null = null;
    topRight : TreeNode | null = null;
    bottomLeft : TreeNode | null = null;
    bottomRight : TreeNode | null = null;

    /**
     * Contains all the objects that are covered by this node if fewer than 8 were inserted, or if more than 8 and we've populated the quadrants,
     * it contains all objects that span multiple quadrants
     */
    objects : CollisionObject[]|null = [];

    public insert(object : CollisionObject) {
        /* If we've got less than 8 objects, just append it to our list */
        if(!this.quadrantsAllocated && (!this.objects || this.objects.length <= 8)) {
            if(!this.objects)
                this.objects = [];
            this.objects.push(object);
            return;
        }
        /* If we haven't allocated quadrants yet, do so */
        if(!this.quadrantsAllocated) {       
            const current_children = this.objects||[];
            this.objects = null;
            for(const obj of current_children) {
                this.insertIntoChildNodes(obj);
            }
            this.quadrantsAllocated = true;
        }

        /* and last, but not least, insert the object we were called with */
        this.insertIntoChildNodes(object);
    }

    private insertIntoChildNodes(object: CollisionObject) {
        // we use object.hitbox to determine which quadrant to insert into
        // quadrants are numbered starting at 0 in the top left and going clockwise
        /* First, figure out which quadrant each corner of the hitbox is in: */
        const quadrants : number[] = [0, 0, 0, 0];
        for(let i = 0; i < 4; i++) {
            if(object.hitbox[i * 2] >= this.x) {
                if(object.hitbox[i * 2 + 1] >= this.y) {
                    quadrants[0] = 0;
                } else {
                    quadrants[3] = 1;
                }
            } else {
                if(object.hitbox[i * 2 + 1] >= this.y) {
                    quadrants[1] = 2;
                } else {
                    quadrants[2] = 3;
                }
            }
        }

        /* check if all corners are in the same quadrant */
        let same_quadrant : boolean = true;
        for(let i = 1; i < 4; i++) {
            if(quadrants[i] != quadrants[0]) {
                same_quadrant = false;
                break;
            }
        }

        if(same_quadrant) {
            // Give it to the appropriate child node
            switch(quadrants[0]) {
                case 0:
                    if (this.topLeft == null)
                        this.topLeft = new TreeNode(this.x - 0.5, this.y - 0.5, this.width / 2, this.height / 2);
                    this.topLeft.insert(object);
                    break;
                case 1:
                    if (this.topRight == null)
                        this.topRight = new TreeNode(this.x + 0.5, this.y - 0.5, this.width / 2, this.height / 2);
                    this.topRight.insert(object);
                    break;
                case 2:
                    if (this.bottomRight == null)
                        this.bottomRight = new TreeNode(this.x + 0.5, this.y + 0.5, this.width / 2, this.height / 2);
                    this.bottomRight.insert(object);
                    break;
                case 3:
                    if (this.bottomLeft == null)
                        this.bottomLeft = new TreeNode(this.x - 0.5, this.y + 0.5, this.width / 2, this.height / 2);
                    this.bottomLeft.insert(object);
                    break;
            }
            return;
        } else {
            // If it spans multiple quadrants, just put it in our object list
            if(!this.objects)
                this.objects = [];
            this.objects.push(object);
        }
    }

    contains(x : number, y : number) : boolean {
        return (Math.abs(x - this.x) <= (this.width / 2)) && (Math.abs(y - this.y) <= (this.height / 2));
    }

    findCollisions(object : CollisionObject, collided : GameObject[]) {
        /* Check the objects that span multiple quadrants or aren't yet put in quadrants */
        if(this.objects) {
            for(const other of this.objects) {
                if(collides(object, other)) {
                    collided.push(other.object);
                }
            }
        }

        /* Check the quadrants */
        if(this.quadrantsAllocated) {
            if(this.topLeft) {
                let checked_out : boolean = false;
                for(let i = 0; !checked_out && i < 4; i++) {
                    if(this.topLeft.contains(object.hitbox[i * 2], object.hitbox[i * 2 + 1])) {
                        this.topLeft.findCollisions(object, collided);
                        checked_out = true;
                    }
                }
            }
            if(this.topRight) {
                let checked_out : boolean = false;
                for(let i = 0; !checked_out && i < 4; i++) {
                    if(this.topRight.contains(object.hitbox[i * 2], object.hitbox[i * 2 + 1])) {
                        this.topRight.findCollisions(object, collided);
                        checked_out = true;
                    }
                }
            }
            if(this.bottomRight) {
                let checked_out : boolean = false;
                for(let i = 0; !checked_out && i < 4; i++) {
                    if(this.bottomRight.contains(object.hitbox[i * 2], object.hitbox[i * 2 + 1])) {
                        this.bottomRight.findCollisions(object, collided);
                        checked_out = true;
                    }
                }
            }
            if(this.bottomLeft) {
                let checked_out : boolean = false;
                for(let i = 0; !checked_out && i < 4; i++) {
                    if(this.bottomLeft.contains(object.hitbox[i * 2], object.hitbox[i * 2 + 1])) {
                        this.bottomLeft.findCollisions(object, collided);
                        checked_out = true;
                    }
                }
            }
        }
    }
    
} /* TreeNode */

function collides(o1 : CollisionObject, o2 : CollisionObject) : boolean {
    if(!aabbCollides(o1.hitbox, o2.hitbox)) {
        return false;
    }

    // If the hitboxes axis-aligned bounding boxes overlap, we need to do a real collision check
    // We'll use the Separating Axis Theorem (SAT) to check for collisions
    // In our case, we'll use the matrix of rotation to generate the inverse matrix of rotation (i.e. the transposition), apply it to both, then check
    // the axis aligned bounding box collision, and do that for both objects
    const o1_rotation_matrix = o1.rotationMatrix;
    const o2_rotation_matrix = o2.rotationMatrix;
    const o1_transposed = transpose_matrix(o1_rotation_matrix);
    const o2_transposed = transpose_matrix(o2_rotation_matrix);
    const o1_hitbox = o1.hitbox;
    const o2_hitbox = o2.hitbox;
    
    // rotate both using o1_transposed and check the aabb collision
    const o1_rotated_by_o1_transposed = applyMatrixToBox(o1_transposed, o1_hitbox);
    const o2_rotated_by_o1_transposed = applyMatrixToBox(o1_transposed, o2_hitbox);
    if(!aabbCollides(o1_rotated_by_o1_transposed, o2_rotated_by_o1_transposed)) {
        return false;
    }

    // rotate both using o2_transposed and check the aabb collision
    const o1_rotated_by_o2_transposed = applyMatrixToBox(o2_transposed, o1_hitbox);
    const o2_rotated_by_o2_transposed = applyMatrixToBox(o2_transposed, o2_hitbox);
    if(!aabbCollides(o1_rotated_by_o2_transposed, o2_rotated_by_o2_transposed)) {
        return false;
    }

    return true;
}

/**
 * Does the Axis-Aligned Bounding Box (AABB) collision detection between two game objects
 */
function aabbCollides(hitbox1 : box2, hitbox2 : box2) {
    const o1_x = findMinMax(hitbox1, 0);
    const o2_x = findMinMax(hitbox2, 0);
    // If they're not overlapping on the x axis, they can't be colliding
    if(o1_x[0] > o2_x[1] || o2_x[0] > o1_x[1]) {
        return false;
    }

    const o1_y = findMinMax(hitbox1, 1);
    const o2_y = findMinMax(hitbox2, 1);
    // If they're not overlapping on the y axis, they can't be colliding
    if(o1_y[0] > o2_y[1] || o2_y[0] > o1_y[1]) {
        return false;
    }

    return true;
}

/**
 * Mostly for finding the min and max x or y values of a box2, but general enough to work with any array of numbers
 * returns [min, max]
 */
function findMinMax(arr : number[], offset : number = 0, stride : number = 2) : [number, number] {
    let min = arr[offset];
    let max = arr[offset];
    for(let i = offset + stride; i < arr.length; i += stride) {
        if(arr[i] < min) {
            min = arr[i];
        }
        if(arr[i] > max) {
            max = arr[i];
        }
    }
    return [min, max];

}


/**
 * For a collision detection pass, you create one of these, build as many trees as you need, then call detectCollisions
 */
export class CollisionDetector {
    boardWidth : number;
    boardHeight : number;
    private objectCache : Map<GameObject, CollisionObject> = new Map();
    private trees : Map<string, TreeNode> = new Map();

    constructor(boardWidth : number, boardHeight : number) {
        this.boardWidth = boardWidth;
        this.boardHeight = boardHeight;
    } 

    buildTree(tag : string, gameObjects : GameObject[]) {
        if(this.trees.has(tag))
            return;
        const tree = new TreeNode(0, 0, this.boardWidth, this.boardHeight);
        for(const object of gameObjects) {
            tree.insert(this.getCollisionObject(object));
        }
    
        this.trees.set(tag, tree);
    }

    private getCollisionObject(o : GameObject) : CollisionObject {
        if(this.objectCache.has(o))
            return this.objectCache.get(o)!;
        let obj = new CollisionObject(o);
        this.objectCache.set(o, obj);
        return obj;
    }

    detectCollisions(objects : GameObject[], tags : string[]) : GameObject[] {
        const collided : GameObject[] = [];

        for(const object of objects) {
            const collisionObject = this.getCollisionObject(object);
            for(const tag of tags) {
                const tree = this.trees.get(tag);
                if(!tree) {
                    console.log("No tree found for tag: " + tag);
                    continue;
                }
                tree.findCollisions(collisionObject, collided);
            }
        }

        return collided;
    }

}

// TODO: perhaps make a Collision class for doing a pass that can do all of the caching possible on a pass, e.g. have a CollisionObject map
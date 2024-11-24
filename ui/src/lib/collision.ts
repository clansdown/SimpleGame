/* Collision detection related code */

import type { GameObject } from "./simplegame";
import { generate_rotation_matrix, multiplyMatrixVector, type box2, type matrix2 } from "./util";

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

    
}

function collides(o1 : CollisionObject, o2 : CollisionObject) {
    if(!aabbCollides(o1.hitbox, o2.hitbox)) {
        return false;
    }

    // If the hitboxes axis-aligned bounding boxes overlap, we need to do a real collision check
    // We'll use the Separating Axis Theorem (SAT) to check for collisions

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
 * populates the hitbox field of the object
 */
function setUpObject(o : GameObject) {

}


export function buildTree(gameObjects : GameObject[], boardWidth : number, boardHeight : number) : TreeNode{
    for(const object of gameObjects) {
        setUpObject(object);
    }

    const tree = new TreeNode(0, 0, boardWidth, boardHeight);
    for(const object of gameObjects) {
        tree.insert(new CollisionObject(object));
    }

    return tree;
}


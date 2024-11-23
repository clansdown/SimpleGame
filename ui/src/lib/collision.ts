/* Collision detection related code */

import type { GameObject } from "./simplegame";

class TreeNode {
    x : number;
    y : number;
    width : number;
    height : number;

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

    objects : GameObject[]|null = [];

    insert(object : GameObject) {
        if(this.topLeft == null && this.topRight == null && this.bottomLeft == null && this.bottomRight == null && (!this.objects || this.objects.length < 4)) {
            if(!this.objects)
                this.objects = [];
            this.objects.push(object);
            return;
        }
        if(this.topLeft == null && this.topRight == null && this.bottomLeft == null && this.bottomRight == null) {       
            // need to create child nodes as appropriate and distribute objects to them
            if(this.objects) {
                for(const obj of this.objects) {
                    this.insertIntoChildNOdes(obj);
                }
            }
            this.insertIntoChildNOdes(object);
            this.objects = null;
        } else {
            /* just need to find the right child tree node to insert into */
            this.insertIntoChildNOdes(object);
        }
    }

    private insertIntoChildNOdes(object: GameObject) {
        if (object.y + object.hitboxHeight / 2 < this.y) {
            if (object.x + object.hitboxWidth / 2 < this.x) {
                if (this.topLeft == null)
                    this.topLeft = new TreeNode(this.x - 0.5, this.y - 0.5, this.width / 2, this.height / 2);
                this.topLeft.insert(object);
            } else {
                if (this.topRight == null)
                    this.topRight = new TreeNode(this.x + 0.5, this.y - 0.5, this.width / 2, this.height / 2);
                this.topRight.insert(object);
            }
        } else {
            if (object.x + object.hitboxWidth / 2 < this.x) {
                if (this.bottomLeft == null)
                    this.bottomLeft = new TreeNode(this.x - 0.5, this.y + 0.5, this.width / 2, this.height / 2);
                this.bottomLeft.insert(object);
            } else {
                if (this.bottomRight == null)
                    this.bottomRight = new TreeNode(this.x + 0.5, this.y + 0.5, this.width / 2, this.height / 2);
                this.bottomRight.insert(object);
            }
        }
    }
}


function buildTree(gameObjects : GameObject[], boardWidth : number, boardHeight : number) {
    const tree = new TreeNode(0, 0, boardWidth, boardHeight);
    for(const object of gameObjects) {
        tree.insert(object);
    }

}


import { GameObject, GameObjectClass } from "./gameclasses";
import { getMousePosition } from "./simplegame";
import type { Position2D } from "./util";

export class ButtonClass extends GameObjectClass {
    constructor(name: string, image_file: string | null = null, parent: GameObjectClass | null = null) {
        super(name, image_file, parent);
    }

    spawn(x: number, y: number, text: string = "", width: number = 100, height: number = 50,
          backgroundImage?: string, color: string = "#A0A080"): Button {
        const button = new Button(this, x, y, text, width, height, backgroundImage, color);
        this.spawned(button);
        return button;
    }
}

export class Button extends GameObject {
    text: string;
    backgroundImage?: HTMLImageElement;
    color: string;
    onClickCallback?: () => void;

    constructor(gameclass: ButtonClass, x: number, y: number, text: string,
                width: number, height: number, backgroundImage?: string, color: string = "#A0A080") {
        super(gameclass, x, y);
        this.text = text;
        this.width = width;
        this.height = height;
        this.color = color;
        this.velocity = 0; // No movement by default
        this.standardMovement = false;

        if (backgroundImage) {
            this.backgroundImage = new Image();
            this.backgroundImage.src = backgroundImage;
        }

        // Set up hitbox to match button size
        this.hitboxWidth = width;
        this.hitboxHeight = height;
        this.hitboxXOffset = 0;
        this.hitboxYOffset = 0;

        // Automatically install onClick handler for left mouse button
        this.onClick(0, (event) => {
            if (this.onClickCallback) this.onClickCallback();
        });
    }

    setText(text: string) {
        this.text = text;
    }

    setOnClick(callback: () => void) {
        this.onClickCallback = callback;
    }



    /**
     * Override draw method to render button with background and text
     */
    draw(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number) {
        ctx.save();

        // Position the button
        ctx.translate(this.x - offsetX, this.y - offsetY);

        // Draw background
        if (this.backgroundImage && this.backgroundImage.complete) {
            // Draw background image
            ctx.drawImage(this.backgroundImage, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            // Draw colored rectangle
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

            // Draw border
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2;
            ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }

        // Draw text
        if (this.text) {
            ctx.fillStyle = "#000000";
            ctx.font = "16px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(this.text, 0, 0);
        }

        ctx.restore();
    }
}
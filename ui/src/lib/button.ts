import { GameObject, GameObjectClass } from "./gameclasses";
import { getMousePosition, buttonDebugLogging } from "./simplegame";
import type { Position2D } from "./util";

export class ButtonClass extends GameObjectClass {
    constructor(name: string, image_file: string | null = null, parent: GameObjectClass | null = null) {
        super(name, image_file, parent);
    }

    spawn(x: number, y: number, text: string = "", width: number = 100, height: number = 50,
          backgroundImage?: string, color: string = "#A0A080", iconFile?: string): Button {
        const button = new Button(this, x, y, text, width, height, backgroundImage, color, iconFile);
        this.spawned(button);
        return button;
    }
}

export class Button extends GameObject {
    text: string;
    backgroundImage?: HTMLImageElement;
    color: string;
    hoverColor: string;
    clickColor: string;
    icon?: HTMLImageElement;
    iconSize: number = 16;
    iconPadding: number = 8;
    isClicked: boolean = false;
    onClickCallback?: () => void;

    constructor(gameclass: ButtonClass, x: number, y: number, text: string,
                width: number, height: number, backgroundImage?: string, color: string = "#A0A080",
                iconFile?: string) {
        super(gameclass, x, y);
        this.text = text;
        this.width = width;
        this.height = height;
        this.color = color;
        this.hoverColor = color;
        this.clickColor = color;
        this.velocity = 0;
        this.standardMovement = false;

        // Compute hover/click tints from base color
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        this.hoverColor = `#${Math.min(255, r + 32).toString(16).padStart(2, '0')}${Math.min(255, g + 32).toString(16).padStart(2, '0')}${Math.min(255, b + 32).toString(16).padStart(2, '0')}`;
        this.clickColor = `#${Math.max(0, r - 32).toString(16).padStart(2, '0')}${Math.max(0, g - 32).toString(16).padStart(2, '0')}${Math.max(0, b - 32).toString(16).padStart(2, '0')}`;

        if (buttonDebugLogging) console.log(`[ButtonDebug] created text="${text}" pos=(${x},${y}) size=${width}x${height} color=${color} hover=${this.hoverColor} click=${this.clickColor} bg=${backgroundImage || "none"} icon=${iconFile || "none"}`);

        if (backgroundImage) {
            this.backgroundImage = new Image();
            this.backgroundImage.onerror = () => { this.backgroundImage = undefined; };
            this.backgroundImage.src = backgroundImage;
        }

        if (iconFile) {
            this.icon = new Image();
            this.icon.onerror = () => { this.icon = undefined; };
            this.icon.src = iconFile;
        }

        // Set up hitbox to match button size
        this.hitboxWidth = width;
        this.hitboxHeight = height;
        this.hitboxXOffset = 0;
        this.hitboxYOffset = 0;

        // Mouseover highlight
        this.onMouseOver(0, () => {
            if (buttonDebugLogging) console.log(`[ButtonDebug] "${this.text}": mouseOver`); });
        this.onMouseOut(0, () => {
            if (buttonDebugLogging) console.log(`[ButtonDebug] "${this.text}": mouseOut`); });

        // Click press indication
        this.onMouseDown(0, () => {
            if (buttonDebugLogging) console.log(`[ButtonDebug] "${this.text}": mouseDown`);
            this.isClicked = true; });
        this.onMouseUp(0, () => {
            if (buttonDebugLogging) console.log(`[ButtonDebug] "${this.text}": mouseUp`);
            this.isClicked = false; });

        // Automatically install onClick handler for left mouse button
        this.onClick(0, (event) => {
            if (buttonDebugLogging) console.log(`[ButtonDebug] "${this.text}": click`);
            this.isClicked = false;
            if (this.onClickCallback) this.onClickCallback();
        });
    }

    setText(text: string) {
        if (buttonDebugLogging) console.log(`[ButtonDebug] "${this.text}" -> setText("${text}")`);
        this.text = text;
    }

    setOnClick(callback: () => void) {
        if (buttonDebugLogging) console.log(`[ButtonDebug] "${this.text}": onClick registered`);
        this.onClickCallback = callback;
    }

    setIcon(iconFile: string) {
        if (buttonDebugLogging) console.log(`[ButtonDebug] "${this.text}": setIcon("${iconFile}")`);
        this.icon = new Image();
        this.icon.onerror = () => { this.icon = undefined; };
        this.icon.src = iconFile;
    }



    /**
     * Override draw method to render button with background and text
     */
    draw(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number) {
        ctx.save();

        ctx.translate(this.x - offsetX, this.y - offsetY);

        // Determine fill color based on state
        let fillColor = this.color;
        if (this.isClicked) {
            fillColor = this.clickColor;
        } else if (this.isHovered) {
            fillColor = this.hoverColor;
        }

        // Draw background
        if (this.backgroundImage && this.backgroundImage.complete) {
            ctx.drawImage(this.backgroundImage, -this.width / 2, -this.height / 2, this.width, this.height);
            if (this.isHovered || this.isClicked) {
                ctx.fillStyle = this.isClicked ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.1)";
                ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            }
        } else {
            ctx.fillStyle = fillColor;
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

            ctx.strokeStyle = this.isClicked ? "#404040" : "#000000";
            ctx.lineWidth = this.isClicked ? 3 : 2;
            ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }

        // Draw icon if present
        let textOffsetX = 0;
        if (this.icon && this.icon.complete) {
            const iconY = -this.iconSize / 2;
            const iconX = -this.width / 2 + this.iconPadding;
            ctx.drawImage(this.icon, iconX, iconY, this.iconSize, this.iconSize);
            textOffsetX = this.iconPadding + this.iconSize;
        }

        // Draw text
        if (this.text) {
            ctx.fillStyle = "#000000";
            ctx.font = "16px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const textX = textOffsetX > 0 ? -this.width / 2 + textOffsetX + (this.width - textOffsetX) / 2 : 0;
            ctx.fillText(this.text, textX, 0);
        }

        if (buttonDebugLogging && (this.isHovered || this.isClicked)) {
            console.log(`[ButtonDebug] draw "${this.text}" hovered=${this.isHovered} clicked=${this.isClicked} fill=${(this.backgroundImage && this.backgroundImage.complete) ? "image" : fillColor}`);
        }

        ctx.restore();
    }
}
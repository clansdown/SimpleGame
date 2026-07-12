import { GameObject, GameObjectClass } from "./gameclasses";
import { getMousePosition, buttonDebugLevel } from "./simplegame";
import type { Position2D } from "./util";

export type IconLayout = "left" | "right" | "above" | "below";

export interface ButtonOptions {
    width?: number;
    height?: number;
    backgroundImage?: string;
    color?: string;
    iconWidth?: number;
    iconHeight?: number;
    iconPadding?: number;
    iconLayout?: IconLayout;
}

export class ButtonClass extends GameObjectClass {
    constructor(name: string, image_file: string | null = null, parent: GameObjectClass | null = null) {
        super(name, image_file, parent);
    }

    spawn(x: number, y: number, text?: string | null, iconFile?: string | null,
          options?: ButtonOptions): Button {
        const button = new Button(this, x, y, text, iconFile, options);
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
    iconWidth: number = 16;
    iconHeight: number = 16;
    iconPadding: number = 8;
    iconLayout: IconLayout = "above";
    isClicked: boolean = false;
    disabled: boolean = false;
    onClickCallback?: () => void;

    constructor(gameclass: ButtonClass, x: number, y: number, text?: string | null,
                iconFile?: string | null, options?: ButtonOptions) {
        super(gameclass, x, y);
        this.text = text ?? "";

        const opts: ButtonOptions = options ?? {};
        const width = opts.width ?? 100;
        const height = opts.height ?? 50;
        const color = opts.color ?? "#A0A080";

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

        if (opts.iconWidth != null) this.iconWidth = opts.iconWidth;
        if (opts.iconHeight != null) this.iconHeight = opts.iconHeight;
        if (opts.iconPadding != null) this.iconPadding = opts.iconPadding;
        if (opts.iconLayout != null) this.iconLayout = opts.iconLayout;

        if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] created text="${this.text}" pos=(${x},${y}) size=${width}x${height} color=${color} hover=${this.hoverColor} click=${this.clickColor} bg=${opts.backgroundImage || "none"} icon=${iconFile || "none"}`);

        if (opts.backgroundImage) {
            this.backgroundImage = new Image();
            this.backgroundImage.onerror = () => { this.backgroundImage = undefined; };
            this.backgroundImage.src = opts.backgroundImage;
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
            if (this.disabled) return;
            if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] "${this.text}": mouseOver`); });
        this.onMouseOut(0, () => {
            if (this.disabled) return;
            if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] "${this.text}": mouseOut`); });

        // Click press indication
        this.onMouseDown(0, () => {
            if (this.disabled) return;
            if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] "${this.text}": mouseDown`);
            this.isClicked = true; });
        this.onMouseUp(0, () => {
            if (this.disabled) return;
            if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] "${this.text}": mouseUp`);
            this.isClicked = false; });

        // Automatically install onClick handler for left mouse button
        this.onClick(0, (event) => {
            if (this.disabled) return;
            if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] "${this.text}": click`);
            this.isClicked = false;
            if (this.onClickCallback) this.onClickCallback();
        });
    }

    setText(text: string) {
        if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] "${this.text}" -> setText("${text}")`);
        this.text = text;
    }

    setOnClick(callback: () => void) {
        if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] "${this.text}": onClick registered`);
        this.onClickCallback = callback;
    }

    setDisabled(disabled: boolean): void {
        if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] "${this.text}": setDisabled(${disabled})`);
        this.disabled = disabled;
    }

    canDrag(): boolean {
        return !this.disabled;
    }

    setIcon(iconFile: string) {
        if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] "${this.text}": setIcon("${iconFile}")`);
        this.icon = new Image();
        this.icon.onerror = () => { this.icon = undefined; };
        this.icon.src = iconFile;
    }

    setIconWidth(w: number): void {
        this.iconWidth = w;
    }

    setIconHeight(h: number): void {
        this.iconHeight = h;
    }

    setIconPadding(pad: number): void {
        this.iconPadding = pad;
    }

    setIconLayout(layout: IconLayout): void {
        this.iconLayout = layout;
    }

    /**
     * Override draw method to render button with background and text
     */
    draw(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number) {
        ctx.save();

        ctx.translate(this.x - offsetX, this.y - offsetY);

        // Determine fill color based on state
        let fillColor = this.color;
        if (!this.disabled) {
            if (this.isClicked) {
                fillColor = this.clickColor;
            } else if (this.isHovered) {
                fillColor = this.hoverColor;
            }
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

        // Draw icon and text based on layout
        const iconImage = this.icon;
        const hasIcon = iconImage && iconImage.complete;

        if (hasIcon) {
            switch (this.iconLayout) {
                case "left": {
                    const iconX = -this.width / 2 + this.iconPadding;
                    const iconY = -this.iconHeight / 2;
                    ctx.drawImage(iconImage, iconX, iconY, this.iconWidth, this.iconHeight);
                    if (this.text) {
                        ctx.fillStyle = "#000000";
                        ctx.font = "16px Arial";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        const textX = (this.iconPadding + this.iconWidth) / 2;
                        ctx.fillText(this.text, textX, 0);
                    }
                    break;
                }
                case "right": {
                    const iconX = this.width / 2 - this.iconPadding - this.iconWidth;
                    const iconY = -this.iconHeight / 2;
                    ctx.drawImage(iconImage, iconX, iconY, this.iconWidth, this.iconHeight);
                    if (this.text) {
                        ctx.fillStyle = "#000000";
                        ctx.font = "16px Arial";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        const textX = -(this.iconPadding + this.iconWidth) / 2;
                        ctx.fillText(this.text, textX, 0);
                    }
                    break;
                }
                case "above": {
                    const iconX = -this.iconWidth / 2;
                    const iconY = -this.height / 2 + this.iconPadding;
                    ctx.drawImage(iconImage, iconX, iconY, this.iconWidth, this.iconHeight);
                    if (this.text) {
                        ctx.fillStyle = "#000000";
                        ctx.font = "16px Arial";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        const textY = (this.iconPadding + this.iconHeight) / 2;
                        ctx.fillText(this.text, 0, textY);
                    }
                    break;
                }
                case "below": {
                    const iconX = -this.iconWidth / 2;
                    const iconY = this.height / 2 - this.iconPadding - this.iconHeight;
                    ctx.drawImage(iconImage, iconX, iconY, this.iconWidth, this.iconHeight);
                    if (this.text) {
                        ctx.fillStyle = "#000000";
                        ctx.font = "16px Arial";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        const textY = -(this.iconPadding + this.iconHeight) / 2;
                        ctx.fillText(this.text, 0, textY);
                    }
                    break;
                }
            }
        } else if (this.text) {
            ctx.fillStyle = "#000000";
            ctx.font = "16px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(this.text, 0, 0);
        }

        // Gray overlay when disabled
        if (this.disabled) {
            ctx.fillStyle = "rgba(128, 128, 128, 0.4)";
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }

        if (buttonDebugLevel >= 1 && (this.isHovered || this.isClicked)) {
            console.log(`[ButtonDebug] draw "${this.text}" hovered=${this.isHovered} clicked=${this.isClicked} fill=${(this.backgroundImage && this.backgroundImage.complete) ? "image" : fillColor}`);
        }

        ctx.restore();
    }
}

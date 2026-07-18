import { GameObject, GameObjectClass } from "./gameclasses";
import { getMousePosition, buttonDebugLevel } from "./simplegame";
import type { Position2D } from "./util";

const TRANSPARENT_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const EST_CHAR_WIDTH = 8;
const EST_TEXT_HEIGHT = 20;
const CONTENT_PAD = 12;

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
    backgroundOpacity?: number;
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
    backgroundOpacity: number = 1;
    isClicked: boolean = false;
    disabled: boolean = false;
    onClickCallback?: () => void;

    constructor(gameclass: ButtonClass, x: number, y: number, text?: string | null,
                iconFile?: string | null, options?: ButtonOptions) {
        super(gameclass, x, y);
        this.text = text ?? "";
        this.velocity = 0;
        this.standardMovement = false;

        const opts: ButtonOptions = options ?? {};
        const color = opts.color ?? "#A0A080";

        this.color = color;
        this.hoverColor = color;
        this.clickColor = color;

        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        this.hoverColor = `#${Math.min(255, r + 32).toString(16).padStart(2, '0')}${Math.min(255, g + 32).toString(16).padStart(2, '0')}${Math.min(255, b + 32).toString(16).padStart(2, '0')}`;
        this.clickColor = `#${Math.max(0, r - 32).toString(16).padStart(2, '0')}${Math.max(0, g - 32).toString(16).padStart(2, '0')}${Math.max(0, b - 32).toString(16).padStart(2, '0')}`;

        if (opts.iconWidth != null) this.iconWidth = opts.iconWidth;
        if (opts.iconHeight != null) this.iconHeight = opts.iconHeight;
        if (opts.iconPadding != null) this.iconPadding = opts.iconPadding;
        if (opts.iconLayout != null) this.iconLayout = opts.iconLayout;
        if (opts.backgroundOpacity != null) this.backgroundOpacity = opts.backgroundOpacity;

        // Load background image — onerror falls back to transparent GIF
        if (opts.backgroundImage) {
            const bg = new Image();
            bg.onerror = () => {
                console.error(`[Button] Failed to load background image "${opts.backgroundImage}" for button "${this.text}"`);
                bg.src = TRANSPARENT_GIF;
            };
            bg.src = opts.backgroundImage;
            this.backgroundImage = bg;
        }

        // Load icon — onerror falls back to transparent GIF
        if (iconFile) {
            const img = new Image();
            img.onerror = () => {
                console.error(`[Button] Failed to load icon "${iconFile}" for button "${this.text}"`);
                img.src = TRANSPARENT_GIF;
            };
            img.src = iconFile;
            this.icon = img;
        }

        // Auto-size based on content
        const textWidth = this.text.length * EST_CHAR_WIDTH;
        const hasText = this.text.length > 0;
        const iconW = this.iconWidth;
        const iconH = this.iconHeight;
        const iconPad = this.iconPadding;
        const hasIconCfg = this.icon !== undefined;

        let autoW: number;
        let autoH: number;

        if (hasIconCfg && hasText) {
            switch (this.iconLayout) {
                case "left":
                case "right":
                    autoW = CONTENT_PAD + iconW + iconPad + textWidth + CONTENT_PAD;
                    autoH = Math.max(iconH, EST_TEXT_HEIGHT) + 2 * CONTENT_PAD;
                    break;
                case "above":
                case "below":
                default:
                    autoW = Math.max(iconW, textWidth) + 2 * CONTENT_PAD;
                    autoH = CONTENT_PAD + iconH + iconPad + EST_TEXT_HEIGHT + CONTENT_PAD;
                    break;
            }
        } else if (hasIconCfg) {
            autoW = iconW + 2 * CONTENT_PAD;
            autoH = iconH + 2 * CONTENT_PAD;
        } else if (hasText) {
            autoW = textWidth + 2 * CONTENT_PAD;
            autoH = EST_TEXT_HEIGHT + 2 * CONTENT_PAD;
        } else {
            autoW = 40;
            autoH = 30;
        }

        this.width = Math.max(opts.width ?? autoW, 40);
        this.height = Math.max(opts.height ?? autoH, 30);

        // Set up hitbox to match button size
        this.hitboxWidth = this.width;
        this.hitboxHeight = this.height;
        this.hitboxXOffset = 0;
        this.hitboxYOffset = 0;

        if (buttonDebugLevel >= 1) console.log(`[ButtonDebug] created text="${this.text}" pos=(${x},${y}) size=${this.width}x${this.height} color=${color} hover=${this.hoverColor} click=${this.clickColor} bg=${opts.backgroundImage || "none"} icon=${iconFile || "none"} layout=${this.iconLayout} opacity=${this.backgroundOpacity}`);

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
        this.onClick(0, () => {
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
        const img = new Image();
        img.onerror = () => {
            console.error(`[Button] Failed to load icon "${iconFile}" for button "${this.text}"`);
            img.src = TRANSPARENT_GIF;
        };
        img.src = iconFile;
        this.icon = img;
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

        // --- Background layer ---
        const bgAlpha = this.backgroundOpacity * this.opacity;
        const needAlpha = bgAlpha < 1 || this.opacity < 1;
        if (needAlpha) {
            ctx.globalAlpha = bgAlpha;
        }

        const bgReady = this.backgroundImage?.complete === true;
        if (bgReady) {
            ctx.drawImage(this.backgroundImage!, -this.width / 2, -this.height / 2, this.width, this.height);
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

        if (needAlpha) {
            ctx.globalAlpha = this.opacity;
        }

        // --- Icon + text layer ---
        ctx.fillStyle = "#000000";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const iconConfigured = this.icon !== undefined;

        // Compute text position — always shifted when icon is configured
        let textX = 0;
        let textY = 0;
        if (iconConfigured && this.text) {
            switch (this.iconLayout) {
                case "left":
                    textX = (this.iconPadding + this.iconWidth) / 2;
                    break;
                case "right":
                    textX = -(this.iconPadding + this.iconWidth) / 2;
                    break;
                case "above":
                    textY = (this.iconPadding + this.iconHeight) / 2;
                    break;
                case "below":
                    textY = -(this.iconPadding + this.iconHeight) / 2;
                    break;
            }
        }

        // Draw icon if ready
        if (iconConfigured && this.icon!.complete) {
            switch (this.iconLayout) {
                case "left": {
                    const iconX = -this.width / 2 + this.iconPadding;
                    const iconY = -this.iconHeight / 2;
                    ctx.drawImage(this.icon!, iconX, iconY, this.iconWidth, this.iconHeight);
                    break;
                }
                case "right": {
                    const iconX = this.width / 2 - this.iconPadding - this.iconWidth;
                    const iconY = -this.iconHeight / 2;
                    ctx.drawImage(this.icon!, iconX, iconY, this.iconWidth, this.iconHeight);
                    break;
                }
                case "above": {
                    const iconX = -this.iconWidth / 2;
                    const iconY = -this.height / 2 + this.iconPadding;
                    ctx.drawImage(this.icon!, iconX, iconY, this.iconWidth, this.iconHeight);
                    break;
                }
                case "below": {
                    const iconX = -this.iconWidth / 2;
                    const iconY = this.height / 2 - this.iconPadding - this.iconHeight;
                    ctx.drawImage(this.icon!, iconX, iconY, this.iconWidth, this.iconHeight);
                    break;
                }
            }
        }

        // Draw text
        if (this.text) {
            ctx.fillText(this.text, textX, textY);
        }

        // --- Gray overlay when disabled ---
        if (this.disabled) {
            ctx.fillStyle = "rgba(128, 128, 128, 0.4)";
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }

        if (buttonDebugLevel >= 1 && (this.isHovered || this.isClicked)) {
            console.log(`[ButtonDebug] draw "${this.text}" hovered=${this.isHovered} clicked=${this.isClicked} fill=${bgReady ? "image" : fillColor}`);
        }

        ctx.restore();
    }
}

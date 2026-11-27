/**
 * Optional text effects for `Text` and `Button`.
 *
 * Effects are paint-only: they never affect layout measurement, button
 * auto-sizing, hitboxes, or cached text measurements.
 */

/** Parameters for an offset drop shadow or solid backdrop. */
export interface TextShadowOptions {
    /** Explicit shadow color. When omitted, a contrast color is derived. */
    color?: string;
    /** Horizontal shadow offset in pixels. Defaults to 2. */
    offsetX?: number;
    /** Vertical shadow offset in pixels. Defaults to 2. */
    offsetY?: number;
    /** Shadow blur radius. Defaults to 4. */
    blur?: number;
    /** Shadow opacity in the range 0–1. Defaults to 1. */
    opacity?: number;
}

/** Parameters for an outline drawn behind the text fill. */
export interface TextOutlineOptions {
    /** Explicit outline color. When omitted, a contrast color is derived. */
    color?: string;
    /** Outline line width in pixels. Defaults to 2. */
    width?: number;
    /** Outline opacity in the range 0–1. Defaults to 1. */
    opacity?: number;
    /** Canvas line join used for the outline. Defaults to "round". */
    lineJoin?: CanvasLineJoin;
}

/** Parameters for a zero-offset glow. */
export interface TextGlowOptions {
    /** Explicit glow color. When omitted, a contrast color is derived. */
    color?: string;
    /** Glow blur radius. Defaults to 6. */
    blur?: number;
    /** Glow opacity in the range 0–1. Defaults to 1. */
    opacity?: number;
}

/**
 * Basic rectangular text background used by the legacy highlight alias.
 *
 * Button background plates are not part of this phase.
 */
export interface TextBackgroundOptions {
    /** Background fill color. */
    color: string;
    /** Padding around each text segment. Defaults to 4. */
    padding?: number;
}

/**
 * Base text-effect options accepted by both `Text` and `Button`.
 *
 * A present sub-object enables that effect. An absent sub-object disables it.
 */
export interface TextEffectOptions {
    /** Offset drop shadow. */
    shadow?: TextShadowOptions;
    /** Outline stroke. */
    outline?: TextOutlineOptions;
    /** Zero-offset glow. Takes precedence over `shadow` when both are present. */
    glow?: TextGlowOptions;
}

/**
 * Text-only effect options.
 *
 * Adds `background` so the existing `Text.setHighlight()` behavior can become
 * an alias for the effect configuration. Button background plates are deferred.
 */
export interface TextLabelEffectOptions extends TextEffectOptions {
    /** Rectangular text background. */
    background?: TextBackgroundOptions;
}

/** Normalized shadow settings with all numeric defaults applied. */
export interface NormalizedTextShadowOptions {
    color?: string;
    offsetX: number;
    offsetY: number;
    blur: number;
    opacity: number;
}

/** Normalized outline settings with all numeric defaults applied. */
export interface NormalizedTextOutlineOptions {
    color?: string;
    width: number;
    opacity: number;
    lineJoin: CanvasLineJoin;
}

/** Normalized glow settings with all numeric defaults applied. */
export interface NormalizedTextGlowOptions {
    color?: string;
    blur: number;
    opacity: number;
}

/** Normalized background settings with all numeric defaults applied. */
export interface NormalizedTextBackgroundOptions {
    color: string;
    padding: number;
}

/** Normalized effect configuration stored by `TextEffectState`. */
export interface NormalizedTextEffectOptions {
    shadow?: NormalizedTextShadowOptions;
    outline?: NormalizedTextOutlineOptions;
    glow?: NormalizedTextGlowOptions;
    background?: NormalizedTextBackgroundOptions;
}

/** A shadow ready to be applied to a canvas context. */
export interface ResolvedTextShadowPaint {
    /** Shadow color, including shadow opacity in its alpha channel. */
    color: string;
    offsetX: number;
    offsetY: number;
    blur: number;
}

/** An outline ready to be painted. */
export interface ResolvedTextOutlinePaint {
    color: string;
    width: number;
    opacity: number;
    lineJoin: CanvasLineJoin;
}

/** A background rectangle ready to be painted. */
export interface ResolvedTextBackgroundPaint {
    color: string;
    padding: number;
}

/** Resolved paint data used by `drawTextRunWithEffects`. */
export interface ResolvedTextEffectPaint {
    shadow?: ResolvedTextShadowPaint;
    outline?: ResolvedTextOutlinePaint;
    background?: ResolvedTextBackgroundPaint;
}

const DEFAULT_SHADOW_OFFSET_X = 2;
const DEFAULT_SHADOW_OFFSET_Y = 2;
const DEFAULT_SHADOW_BLUR = 4;
const DEFAULT_OUTLINE_WIDTH = 2;
const DEFAULT_OUTLINE_LINE_JOIN: CanvasLineJoin = "round";
const DEFAULT_GLOW_BLUR = 6;
const DEFAULT_BACKGROUND_PADDING = 4;
const DEFAULT_OPACITY = 1;

/**
 * Returns a finite number or the supplied fallback.
 *
 * @param value - Candidate value
 * @param fallback - Value to return when `value` is undefined or non-finite
 * @returns The finite candidate or the fallback
 */
function finiteOrDefault(value: number | undefined, fallback: number): number {
    return value !== undefined && Number.isFinite(value) ? value : fallback;
}

/**
 * Clamps a value into the range 0–1.
 *
 * @param value - Candidate opacity
 * @returns Opacity clamped to the range 0–1
 */
function clampOpacity(value: number): number {
    return Math.max(0, Math.min(1, value));
}

/**
 * Clamps a value to zero or greater.
 *
 * @param value - Candidate non-negative value
 * @returns The value clamped to zero or greater
 */
function clampNonNegative(value: number): number {
    return Math.max(0, value);
}

/**
 * Normalizes an optional explicit color.
 *
 * @param color - Candidate CSS color
 * @returns The color, or undefined for omitted/blank values
 */
function normalizeOptionalColor(color: string | undefined): string | undefined {
    if (typeof color !== "string" || color.trim() === "") return undefined;
    return color;
}

/**
 * Normalizes shadow options, applying defaults.
 *
 * @param options - Optional shadow configuration
 * @returns Normalized shadow settings, or undefined when disabled
 */
export function normalizeTextShadowOptions(
    options?: TextShadowOptions
): NormalizedTextShadowOptions | undefined {
    if (!options) return undefined;
    return {
        color: normalizeOptionalColor(options.color),
        offsetX: finiteOrDefault(options.offsetX, DEFAULT_SHADOW_OFFSET_X),
        offsetY: finiteOrDefault(options.offsetY, DEFAULT_SHADOW_OFFSET_Y),
        blur: clampNonNegative(finiteOrDefault(options.blur, DEFAULT_SHADOW_BLUR)),
        opacity: clampOpacity(finiteOrDefault(options.opacity, DEFAULT_OPACITY)),
    };
}

/**
 * Normalizes outline options, applying defaults.
 *
 * @param options - Optional outline configuration
 * @returns Normalized outline settings, or undefined when disabled
 */
export function normalizeTextOutlineOptions(
    options?: TextOutlineOptions
): NormalizedTextOutlineOptions | undefined {
    if (!options) return undefined;
    return {
        color: normalizeOptionalColor(options.color),
        width: clampNonNegative(finiteOrDefault(options.width, DEFAULT_OUTLINE_WIDTH)),
        opacity: clampOpacity(finiteOrDefault(options.opacity, DEFAULT_OPACITY)),
        lineJoin: options.lineJoin ?? DEFAULT_OUTLINE_LINE_JOIN,
    };
}

/**
 * Normalizes glow options, applying defaults.
 *
 * @param options - Optional glow configuration
 * @returns Normalized glow settings, or undefined when disabled
 */
export function normalizeTextGlowOptions(
    options?: TextGlowOptions
): NormalizedTextGlowOptions | undefined {
    if (!options) return undefined;
    return {
        color: normalizeOptionalColor(options.color),
        blur: clampNonNegative(finiteOrDefault(options.blur, DEFAULT_GLOW_BLUR)),
        opacity: clampOpacity(finiteOrDefault(options.opacity, DEFAULT_OPACITY)),
    };
}

/**
 * Normalizes background options, applying defaults.
 *
 * @param options - Optional background configuration
 * @returns Normalized background settings, or undefined when disabled
 */
export function normalizeTextBackgroundOptions(
    options?: TextBackgroundOptions
): NormalizedTextBackgroundOptions | undefined {
    if (!options || typeof options.color !== "string" || options.color.trim() === "") {
        return undefined;
    }
    return {
        color: options.color,
        padding: clampNonNegative(finiteOrDefault(options.padding, DEFAULT_BACKGROUND_PADDING)),
    };
}

/**
 * Normalizes a complete Text effect configuration.
 *
 * @param options - Optional effect configuration
 * @returns A new normalized configuration, or an empty object when disabled
 */
export function normalizeTextEffectOptions(
    options?: TextLabelEffectOptions
): NormalizedTextEffectOptions {
    if (!options) return {};
    return {
        shadow: normalizeTextShadowOptions(options.shadow),
        outline: normalizeTextOutlineOptions(options.outline),
        glow: normalizeTextGlowOptions(options.glow),
        background: normalizeTextBackgroundOptions(options.background),
    };
}

/**
 * Per-instance normalized effect state for `Text` and `Button`.
 *
 * The state is the source of truth for effects. Caller-supplied option objects
 * are normalized into new objects and are not retained by reference.
 */
export class TextEffectState {
    private options: NormalizedTextEffectOptions = {};

    /**
     * Replaces the entire effect configuration.
     *
     * @param options - New effect configuration; omit to clear all effects
     */
    setOptions(options?: TextLabelEffectOptions): void {
        this.options = normalizeTextEffectOptions(options);
    }

    /**
     * Replaces the effect configuration using only the shared base effects.
     *
     * Used by `Button`, which does not support the Text-only background effect.
     * Any runtime-supplied `background` property is deliberately discarded.
     *
     * @param options - Shared shadow/outline/glow configuration
     */
    setBaseOptions(options?: TextEffectOptions): void {
        this.options = normalizeTextEffectOptions({
            shadow: options?.shadow,
            outline: options?.outline,
            glow: options?.glow,
        });
    }

    /** Clears all effects, including background. */
    clear(): void {
        this.options = {};
    }

    /**
     * Returns the normalized effect configuration.
     *
     * @returns Read-only view of the current effect state
     */
    getOptions(): Readonly<NormalizedTextEffectOptions> {
        return this.options;
    }

    /**
     * Patches or creates a shadow for the legacy `Text.setShadow()` method.
     *
     * @param color - Explicit shadow color
     * @param blur - Optional blur update
     * @param offsetX - Optional horizontal offset update
     * @param offsetY - Optional vertical offset update
     */
    setShadowLegacy(
        color: string,
        blur?: number,
        offsetX?: number,
        offsetY?: number
    ): void {
        if (typeof color !== "string" || color.trim() === "") {
            delete this.options.shadow;
            return;
        }
        const existing = this.options.shadow;
        this.options.shadow = {
            color,
            blur: clampNonNegative(
                finiteOrDefault(blur, existing?.blur ?? DEFAULT_SHADOW_BLUR)
            ),
            offsetX: finiteOrDefault(offsetX, existing?.offsetX ?? DEFAULT_SHADOW_OFFSET_X),
            offsetY: finiteOrDefault(offsetY, existing?.offsetY ?? DEFAULT_SHADOW_OFFSET_Y),
            opacity: existing?.opacity ?? DEFAULT_OPACITY,
        };
    }

    /**
     * Patches or creates a background for the legacy `Text.setHighlight()` method.
     *
     * @param color - Background color
     * @param padding - Optional padding update
     */
    setBackgroundLegacy(color: string, padding?: number): void {
        if (typeof color !== "string" || color.trim() === "") {
            delete this.options.background;
            return;
        }
        const existing = this.options.background;
        this.options.background = {
            color,
            padding: clampNonNegative(
                finiteOrDefault(padding, existing?.padding ?? DEFAULT_BACKGROUND_PADDING)
            ),
        };
    }

    /**
     * Returns the explicit shadow color.
     *
     * @returns Explicit color, or undefined when auto-colored or disabled
     */
    getShadowColor(): string | undefined {
        return this.options.shadow?.color;
    }

    /**
     * Sets or clears the legacy shadow color field.
     *
     * @param color - Explicit color, or undefined to disable the shadow
     */
    setShadowColor(color: string | undefined): void {
        if (typeof color !== "string" || color.trim() === "") {
            delete this.options.shadow;
            return;
        }
        if (this.options.shadow) {
            this.options.shadow = { ...this.options.shadow, color };
            return;
        }
        this.options.shadow = {
            color,
            offsetX: DEFAULT_SHADOW_OFFSET_X,
            offsetY: DEFAULT_SHADOW_OFFSET_Y,
            blur: DEFAULT_SHADOW_BLUR,
            opacity: DEFAULT_OPACITY,
        };
    }

    /**
     * Returns the active shadow blur.
     *
     * @returns Active blur, or the default when no shadow exists
     */
    getShadowBlur(): number {
        return this.options.shadow?.blur ?? DEFAULT_SHADOW_BLUR;
    }

    /**
     * Updates the legacy shadow blur when a shadow exists.
     *
     * @param blur - New blur radius
     */
    setShadowBlur(blur: number): void {
        if (!this.options.shadow) return;
        this.options.shadow.blur = clampNonNegative(
            finiteOrDefault(blur, this.options.shadow.blur)
        );
    }

    /**
     * Returns the active horizontal shadow offset.
     *
     * @returns Active offset, or the default when no shadow exists
     */
    getShadowOffsetX(): number {
        return this.options.shadow?.offsetX ?? DEFAULT_SHADOW_OFFSET_X;
    }

    /**
     * Updates the legacy horizontal shadow offset when a shadow exists.
     *
     * @param offsetX - New horizontal offset
     */
    setShadowOffsetX(offsetX: number): void {
        if (!this.options.shadow) return;
        this.options.shadow.offsetX = finiteOrDefault(offsetX, this.options.shadow.offsetX);
    }

    /**
     * Returns the active vertical shadow offset.
     *
     * @returns Active offset, or the default when no shadow exists
     */
    getShadowOffsetY(): number {
        return this.options.shadow?.offsetY ?? DEFAULT_SHADOW_OFFSET_Y;
    }

    /**
     * Updates the legacy vertical shadow offset when a shadow exists.
     *
     * @param offsetY - New vertical offset
     */
    setShadowOffsetY(offsetY: number): void {
        if (!this.options.shadow) return;
        this.options.shadow.offsetY = finiteOrDefault(offsetY, this.options.shadow.offsetY);
    }

    /**
     * Returns the explicit background color.
     *
     * @returns Background color, or undefined when disabled
     */
    getBackgroundColor(): string | undefined {
        return this.options.background?.color;
    }

    /**
     * Sets or clears the legacy highlight color field.
     *
     * @param color - Background color, or undefined to disable the background
     */
    setBackgroundColor(color: string | undefined): void {
        if (typeof color !== "string" || color.trim() === "") {
            delete this.options.background;
            return;
        }
        if (this.options.background) {
            this.options.background = { ...this.options.background, color };
            return;
        }
        this.options.background = {
            color,
            padding: DEFAULT_BACKGROUND_PADDING,
        };
    }

    /**
     * Returns the active background padding.
     *
     * @returns Active padding, or the default when no background exists
     */
    getBackgroundPadding(): number {
        return this.options.background?.padding ?? DEFAULT_BACKGROUND_PADDING;
    }

    /**
     * Updates the legacy highlight padding when a background exists.
     *
     * @param padding - New padding around each text segment
     */
    setBackgroundPadding(padding: number): void {
        if (!this.options.background) return;
        this.options.background.padding = clampNonNegative(
            finiteOrDefault(padding, this.options.background.padding)
        );
    }
}

/**
 * Normalizes a CSS color through the supplied canvas context.
 *
 * @param ctx - Canvas context used for color parsing
 * @param color - CSS color string
 * @returns Normalized color string, or undefined when unavailable
 */
export function normalizeCssColor(
    ctx: CanvasRenderingContext2D,
    color: string
): string | undefined {
    ctx.save();
    try {
        ctx.fillStyle = "#000000";
        ctx.fillStyle = color;
        return typeof ctx.fillStyle === "string" ? ctx.fillStyle : undefined;
    } finally {
        ctx.restore();
    }
}

/**
 * Parses a normalized CSS color into RGBA components.
 *
 * Supports normalized hex and rgb()/rgba() forms. Other CSS forms are left to
 * the best-effort fallback paths in the effect renderer.
 *
 * @param color - Normalized CSS color string
 * @returns Parsed components, or undefined when unsupported
 */
export function parseNormalizedCssColor(
    color: string
): { r: number; g: number; b: number; a: number } | undefined {
    const value = color.trim();

    const hexMatch = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value);
    if (hexMatch) {
        const hex = hexMatch[1];
        if (hex.length === 3 || hex.length === 4) {
            const r = parseInt(hex[0] + hex[0], 16);
            const g = parseInt(hex[1] + hex[1], 16);
            const b = parseInt(hex[2] + hex[2], 16);
            const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
            return { r, g, b, a };
        }
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return { r, g, b, a };
    }

    const rgbMatch =
        /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i.exec(
            value
        );
    if (!rgbMatch) return undefined;

    return {
        r: Math.max(0, Math.min(255, Number(rgbMatch[1]))),
        g: Math.max(0, Math.min(255, Number(rgbMatch[2]))),
        b: Math.max(0, Math.min(255, Number(rgbMatch[3]))),
        a: rgbMatch[4] !== undefined
            ? Math.max(0, Math.min(1, Number(rgbMatch[4])))
            : 1,
    };
}

/**
 * Resolves an effect color, deriving a neutral contrast color when omitted.
 *
 * This is intentionally best-effort. Explicit colors are the reliable option.
 *
 * @param ctx - Canvas context used for color parsing
 * @param foregroundColor - Current text fill color
 * @returns White for dark text, black for light text
 */
export function resolveAutoTextEffectColor(
    ctx: CanvasRenderingContext2D,
    foregroundColor: string
): string {
    const normalized = normalizeCssColor(ctx, foregroundColor);
    const parsed = normalized ? parseNormalizedCssColor(normalized) : undefined;
    if (!parsed) return "#ffffff";

    const luminance = (0.299 * parsed.r + 0.587 * parsed.g + 0.114 * parsed.b) / 255;
    return luminance >= 0.5 ? "#000000" : "#ffffff";
}

/**
 * Applies an opacity multiplier to a CSS color.
 *
 * @param ctx - Canvas context used for color parsing
 * @param color - CSS color string
 * @param opacity - Opacity multiplier in the range 0–1
 * @returns An rgba() color when parsing succeeds; the original color otherwise
 */
export function applyCssColorAlpha(
    ctx: CanvasRenderingContext2D,
    color: string,
    opacity: number
): string {
    const clamped = clampOpacity(opacity);
    if (clamped >= 1) return color;

    const normalized = normalizeCssColor(ctx, color);
    const parsed = normalized ? parseNormalizedCssColor(normalized) : undefined;
    if (!parsed) return color;

    const alpha = Math.max(0, Math.min(1, parsed.a * clamped));
    return `rgba(${Math.round(parsed.r)}, ${Math.round(parsed.g)}, ${Math.round(parsed.b)}, ${alpha})`;
}

/**
 * Applies a resolved shadow configuration to a canvas context.
 *
 * @param ctx - Canvas context
 * @param shadow - Resolved shadow paint
 */
export function applyResolvedTextShadow(
    ctx: CanvasRenderingContext2D,
    shadow: ResolvedTextShadowPaint
): void {
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur;
    ctx.shadowOffsetX = shadow.offsetX;
    ctx.shadowOffsetY = shadow.offsetY;
}

/**
 * Clears native shadow state before a text fill that must not cast a shadow.
 *
 * @param ctx - Canvas context to clear
 */
function clearResolvedTextShadow(ctx: CanvasRenderingContext2D): void {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

/**
 * Resolves normalized effects into paint data for a single draw.
 *
 * Auto colors are resolved from the current foreground color. Glow takes
 * precedence over shadow when both are configured.
 *
 * @param ctx - Canvas context used for color parsing
 * @param foregroundColor - Current text fill color
 * @param options - Normalized effect configuration
 * @returns Paint-only effect data
 */
export function resolveTextEffects(
    ctx: CanvasRenderingContext2D,
    foregroundColor: string,
    options: NormalizedTextEffectOptions
): ResolvedTextEffectPaint {
    const resolved: ResolvedTextEffectPaint = {};

    if (options.background) {
        resolved.background = {
            color: options.background.color,
            padding: options.background.padding,
        };
    }

    if (options.outline && options.outline.width > 0 && options.outline.opacity > 0) {
        resolved.outline = {
            color: options.outline.color ?? resolveAutoTextEffectColor(ctx, foregroundColor),
            width: options.outline.width,
            opacity: options.outline.opacity,
            lineJoin: options.outline.lineJoin,
        };
    }

    if (options.glow) {
        // Glow presence wins even when its opacity is zero; shadow remains
        // suppressed rather than taking over.
        if (options.glow.opacity > 0) {
            const color =
                options.glow.color ?? resolveAutoTextEffectColor(ctx, foregroundColor);
            resolved.shadow = {
                color: applyCssColorAlpha(ctx, color, options.glow.opacity),
                offsetX: 0,
                offsetY: 0,
                blur: options.glow.blur,
            };
        }
    } else if (options.shadow && options.shadow.opacity > 0) {
        const color =
            options.shadow.color ?? resolveAutoTextEffectColor(ctx, foregroundColor);
        resolved.shadow = {
            color: applyCssColorAlpha(ctx, color, options.shadow.opacity),
            offsetX: options.shadow.offsetX,
            offsetY: options.shadow.offsetY,
            blur: options.shadow.blur,
        };
    }

    return resolved;
}

/**
 * Draws a text run with optional outline and shadow/glow.
 *
 * The caller must configure `font`, `textAlign`, and `textBaseline`. This
 * function only paints the outline, shadow, and fill; it never measures or
 * draws backgrounds.
 *
 * If an outline exists, the outline casts the active shadow/glow and the fill
 * is drawn without a shadow. If no outline exists, the fill casts the shadow.
 *
 * @param ctx - Canvas context
 * @param text - Text to draw
 * @param x - Draw x coordinate
 * @param y - Draw y coordinate
 * @param foregroundColor - Text fill color
 * @param paint - Resolved effect paint data
 */
export function drawTextRunWithEffects(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    foregroundColor: string,
    paint: ResolvedTextEffectPaint
): void {
    if (!text) return;

    if (paint.outline) {
        ctx.save();
        if (paint.shadow) applyResolvedTextShadow(ctx, paint.shadow);
        else clearResolvedTextShadow(ctx);
        if (paint.outline.opacity < 1) {
            ctx.globalAlpha *= paint.outline.opacity;
        }
        ctx.strokeStyle = paint.outline.color;
        ctx.lineWidth = paint.outline.width;
        ctx.lineJoin = paint.outline.lineJoin;
        ctx.strokeText(text, x, y);
        ctx.restore();

        ctx.save();
        clearResolvedTextShadow(ctx);
        ctx.fillStyle = foregroundColor;
        ctx.fillText(text, x, y);
        ctx.restore();
        return;
    }

    ctx.save();
    if (paint.shadow) applyResolvedTextShadow(ctx, paint.shadow);
    else clearResolvedTextShadow(ctx);
    ctx.fillStyle = foregroundColor;
    ctx.fillText(text, x, y);
    ctx.restore();
}

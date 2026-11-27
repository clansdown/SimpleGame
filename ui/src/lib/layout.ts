import { GameObject, GameObjectClass } from "./gameclasses";
import {
    gameObjects,
    boardWidth,
    boardHeight,
    registerLayoutParticipant,
    unregisterLayoutParticipant,
    isHud,
} from "./simplegame";

export enum LayoutJustify {
    START = "start",
    CENTER = "center",
    END = "end",
    SPACE_BETWEEN = "space-between",
    SPACE_AROUND = "space-around"
}

export enum LayoutAlign {
    START = "start",
    CENTER = "center",
    END = "end",
    STRETCH = "stretch"
}

type LayoutChildMeasurement = {
    child: GameObject;
    width: number;
    height: number;
};

type RowLine = {
    children: LayoutChildMeasurement[];
    width: number;
    height: number;
};

/** Options for removing a layout child. */
export type RemoveChildOptions = {
    /** Keep the detached child visible. Default false for effective-HUD children. */
    keepVisible?: boolean;
};

/** Returns the smaller of two optional dimensions. */
function minDefined(a: number | undefined, b: number | undefined): number | undefined {
    if (a === undefined) return b;
    if (b === undefined) return a;
    return Math.min(a, b);
}

/**
 * Updates the attachment offset for a child of a non-LayoutContainer owner.
 */
function syncAttachOffsetFor(owner: GameObject, child: GameObject): void {
    for (const attached of owner.attachedObjects) {
        if (attached.gameObject === child) {
            attached.offsetX = child.x - owner.x;
            attached.offsetY = child.y - owner.y;
        }
    }
}

/**
 * Base class for containers that arrange attached children.
 *
 * Layout is invalidated rather than performed immediately. The engine reflows
 * dirty participants before drawing and before a paused redraw.
 */
export class LayoutContainer extends GameObject {
    children: GameObject[] = [];
    padding: number = 0;
    gutter: number = 0;
    borderWidth: number = 0;
    borderColor: string = "#000000";
    justify: LayoutJustify = LayoutJustify.START;
    align: LayoutAlign = LayoutAlign.START;
    explicitWidth?: number;
    explicitHeight?: number;
    maxWidth?: number;
    layoutDirty: boolean = true;

    constructor(x: number, y: number) {
        const layoutClass = new GameObjectClass("layout-container", null, null);
        super(layoutClass, x, y);
        this.layoutCanResizeMe = false;
        this.destroyAttachedOnDestroy = true;
        gameObjects.add(this);
        registerLayoutParticipant(this);
    }

    override invalidateLayout(): void {
        this.layoutDirty = true;
        super.invalidateLayout();
    }

    override destroy(): void {
        unregisterLayoutParticipant(this);
        super.destroy();
        this.children.length = 0;
    }

    /**
     * Removes a destroyed child from the layout children and attachment list.
     */
    override onChildDestroyed(child: GameObject): void {
        const index = this.children.indexOf(child);
        if (index > -1) {
            this.children.splice(index, 1);
        }
        super.onChildDestroyed(child);
        if (!this.destroyed) {
            this.invalidateLayout();
        }
    }

    /**
     * Performs a layout pass and clears the dirty flag.
     */
    layout(): void {
        this.layoutDirty = false;
        this.performLayout();
        this.layoutDirty = false;
    }

    /**
     * Subclass hook for the actual arrangement pass.
     */
    protected performLayout(): void {
        // Free-form containers apply assigned or explicit dimensions.
        if (this.layoutAssignedWidth !== undefined) {
            this.width = this.layoutAssignedWidth;
        } else if (this.explicitWidth !== undefined) {
            this.width = this.explicitWidth;
        }
        if (this.layoutAssignedHeight !== undefined) {
            this.height = this.layoutAssignedHeight;
        } else if (this.explicitHeight !== undefined) {
            this.height = this.explicitHeight;
        }

        const innerWidth = this.getBoundedInnerWidth();
        const innerHeight = this.getBoundedInnerHeight();
        for (const child of this.children) {
            child.applyLayoutAvailableWidth(innerWidth);
            child.applyLayoutAvailableHeight(innerHeight);
            child.layoutForMeasurement();
        }
        this.syncAttachOffsets();
    }

    addChild(child: GameObject) {
        this.children.push(child);
        this.attach(child, 0, 0, 0);
        child.setLocation(this.x, this.y);
        this.invalidateLayout();
    }

    /**
     * Adds a child at an explicit position relative to the container.
     *
     * @param child - Child to add
     * @param x - Absolute position on the same axis as the container
     * @param y - Absolute position on the same axis as the container
     */
    addChildAt(child: GameObject, x: number, y: number) {
        this.children.push(child);
        this.attach(child, x - this.x, y - this.y, 0);
        child.setLocation(x, y);
        this.invalidateLayout();
    }

    /**
     * Removes a child from the layout and detaches it.
     *
     * Effective-HUD children are hidden by default so they do not fall into
     * board space and draw at screen-like coordinates.
     *
     * @param child - Child to remove
     * @param options - Removal options; `keepVisible` preserves visibility
     */
    removeChild(child: GameObject, options?: RemoveChildOptions) {
        const index = this.children.indexOf(child);
        if (index === -1) return;

        const wasHud = isHud(this);
        this.children.splice(index, 1);
        this.detach(child);
        if (wasHud && !options?.keepVisible) {
            child.setVisible(false);
        }
        this.invalidateLayout();
    }

    /**
     * Refreshes attached offsets from the children's current positions.
     */
    syncAttachOffsets(): void {
        for (const attached of this.attachedObjects) {
            attached.offsetX = attached.gameObject.x - this.x;
            attached.offsetY = attached.gameObject.y - this.y;
        }
    }

    /**
     * Moves the container after preserving current child offsets.
     */
    override setLocation(x: number, y: number): void {
        this.syncAttachOffsets();
        super.setLocation(x, y);
    }

    /**
     * Updates attached children after an attached parent moves this container.
     */
    override onAttachedParentMoved(): void {
        this.updateAttached();
    }

    /**
     * Applies a parent-assigned width and marks this container for reflow so its
     * interior uses the assigned size.
     */
    override setLayoutWidth(width: number): void {
        super.setLayoutWidth(width);
        this.layoutDirty = true;
    }

    /**
     * Applies a parent-assigned height and marks this container for reflow so its
     * interior uses the assigned size.
     */
    override setLayoutHeight(height: number): void {
        super.setLayoutHeight(height);
        this.layoutDirty = true;
    }

    /**
     * Applies a width constraint supplied by a parent layout container.
     */
    override applyLayoutAvailableWidth(width: number | undefined): void {
        if (this.layoutAvailableWidth === width) return;
        this.layoutAvailableWidth = width;
        this.invalidateLayout();
    }

    /**
     * Applies a height constraint supplied by a parent layout container.
     */
    override applyLayoutAvailableHeight(height: number | undefined): void {
        if (this.layoutAvailableHeight === height) return;
        this.layoutAvailableHeight = height;
        this.invalidateLayout();
    }

    /**
     * Reflows this container before a parent measures it.
     */
    override layoutForMeasurement(): void {
        if (this.layoutDirty) {
            this.layout();
        }
    }

    /**
     * Returns the bounded inner width after explicit width, max width, and
     * parent-provided available width are resolved.
     */
    protected getBoundedInnerWidth(): number | undefined {
        const outer =
            this.layoutAssignedWidth ??
            this.explicitWidth ??
            minDefined(this.maxWidth, this.layoutAvailableWidth);
        return outer === undefined
            ? undefined
            : Math.max(0, outer - this.padding * 2);
    }

    /**
     * Returns the bounded inner height after explicit height and parent-provided
     * available height are resolved.
     */
    protected getBoundedInnerHeight(): number | undefined {
        const outer =
            this.layoutAssignedHeight ??
            this.explicitHeight ??
            this.layoutAvailableHeight;
        return outer === undefined
            ? undefined
            : Math.max(0, outer - this.padding * 2);
    }

    /**
     * Returns START when content exceeds the inner axis, otherwise the
     * configured justify mode. This keeps overflow on the trailing edge.
     */
    protected resolveJustifyWithOverflow(availableSpace: number): LayoutJustify {
        return availableSpace < 0 ? LayoutJustify.START : this.justify;
    }

    setPadding(padding: number) {
        this.padding = padding;
        this.invalidateLayout();
    }

    setGutter(gutter: number) {
        this.gutter = gutter;
        this.invalidateLayout();
    }

    setBorder(width: number, color?: string) {
        this.borderWidth = width;
        if (color) this.borderColor = color;
    }

    setJustify(justify: LayoutJustify) {
        this.justify = justify;
        this.invalidateLayout();
    }

    setAlign(align: LayoutAlign) {
        this.align = align;
        this.invalidateLayout();
    }

    setSize(width: number, height: number) {
        this.explicitWidth = width;
        this.explicitHeight = height;
        this.width = width;
        this.height = height;
        this.invalidateLayout();
    }

    /** Sets an explicit width, auto-sizes height, and invalidates layout. */
    setWidth(width: number) {
        this.explicitWidth = width;
        this.explicitHeight = undefined;
        this.width = width;
        this.invalidateLayout();
    }

    /** Sets an explicit height, auto-sizes width, and invalidates layout. */
    setHeight(height: number) {
        this.explicitHeight = height;
        this.explicitWidth = undefined;
        this.height = height;
        this.invalidateLayout();
    }

    /** Sets an available width while preserving any explicit height. */
    setAvailableWidth(width: number) {
        this.explicitWidth = width;
        this.invalidateLayout();
    }

    /** Sets an available height while preserving any explicit width. */
    setAvailableHeight(height: number) {
        this.explicitHeight = height;
        this.invalidateLayout();
    }

    setMaxWidth(maxWidth: number | null) {
        this.maxWidth = maxWidth ?? undefined;
        this.invalidateLayout();
    }

    setAutoWidth() {
        this.explicitWidth = undefined;
        this.invalidateLayout();
    }

    setAutoHeight() {
        this.explicitHeight = undefined;
        this.invalidateLayout();
    }

    override setVisible(visible: boolean): void {
        super.setVisible(visible);
    }

    doMovement(delta_t: number): void {
        // Layout containers don't move independently
    }

    draw(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
        if (this.width <= 0 || this.height <= 0) return;
        ctx.save();
        ctx.translate(this.x - offsetX, this.y - offsetY);
        if (this.opacity < 1) {
            ctx.globalAlpha = this.opacity;
        }
        if (this.borderWidth > 0) {
            ctx.strokeStyle = this.borderColor;
            ctx.lineWidth = this.borderWidth;
            ctx.strokeRect(
                -this.width / 2, -this.height / 2,
                this.width, this.height,
            );
        }
        ctx.restore();
    }

    getContentWidth(): number {
        const children = this.getVisibleChildren();
        if (children.length === 0) return 0;
        let min = Infinity;
        let max = -Infinity;
        for (const child of children) {
            const centerX = child.x + child.getLayoutOffsetX();
            min = Math.min(min, centerX - child.getLayoutVisualWidth() / 2);
            max = Math.max(max, centerX + child.getLayoutVisualWidth() / 2);
        }
        return max - min;
    }

    getContentHeight(): number {
        const children = this.getVisibleChildren();
        if (children.length === 0) return 0;
        let min = Infinity;
        let max = -Infinity;
        for (const child of children) {
            const centerY = child.y + child.getLayoutOffsetY();
            min = Math.min(min, centerY - child.getLayoutVisualHeight() / 2);
            max = Math.max(max, centerY + child.getLayoutVisualHeight() / 2);
        }
        return max - min;
    }

    /**
     * Captures the child's intrinsic width and applies a layout-assigned width.
     */
    protected setChildLayoutWidth(child: GameObject, width: number): void {
        child.captureLayoutIntrinsicWidth();
        child.setLayoutWidth(width);
    }

    /**
     * Captures the child's intrinsic height and applies a layout-assigned height.
     */
    protected setChildLayoutHeight(child: GameObject, height: number): void {
        child.captureLayoutIntrinsicHeight();
        child.setLayoutHeight(height);
    }

    protected getVisibleChildren(): GameObject[] {
        return this.children.filter(child => child.visible);
    }

    /**
     * Measures visible children with the layout measurement API.
     *
     * Bounded nested layout containers receive the parent's inner size and are
     * reflowed before measurement so wrapping rows can respond to the parent.
     */
    protected measureChildren(): LayoutChildMeasurement[] {
        const children = this.getVisibleChildren();
        const innerWidth = this.getBoundedInnerWidth();
        const innerHeight = this.getBoundedInnerHeight();

        for (const child of children) {
            child.applyLayoutAvailableWidth(innerWidth);
            child.applyLayoutAvailableHeight(innerHeight);
            child.layoutForMeasurement();
        }

        return children.map(child => ({
            child: child,
            width: child.getLayoutWidth(),
            height: child.getLayoutHeight(),
        }));
    }
}

/**
 * Horizontal layout container with optional wrapping.
 */
export class Row extends LayoutContainer {
    wrap: boolean = false;
    lineGap: number = 0;

    constructor(x: number, y: number) {
        super(x, y);
        this.layoutCanResizeMe = true;
    }

    setWrap(enabled: boolean) {
        this.wrap = enabled;
        this.invalidateLayout();
    }

    setLineGap(gap: number) {
        this.lineGap = gap;
        this.invalidateLayout();
    }

    protected override performLayout(): void {
        for (const child of this.children) {
            child.restoreLayoutIntrinsicSize();
        }
        const children = this.measureChildren();
        if (children.length === 0) {
            this.width = this.layoutAssignedWidth ?? this.explicitWidth ?? 0;
            this.height = this.layoutAssignedHeight ?? this.explicitHeight ?? 0;
            return;
        }

        if (this.wrap) {
            this.layoutWrappedLines(children);
        } else {
            this.layoutSingleLine(children);
        }
    }

    private layoutSingleLine(children: LayoutChildMeasurement[]): void {
        const totalChildrenWidth = children.reduce((sum, c) => sum + c.width, 0);
        const totalGutters = Math.max(0, children.length - 1) * this.gutter;
        const contentWidth = totalChildrenWidth + totalGutters;
        const naturalWidth = this.padding * 2 + contentWidth;
        const boundedOuter =
            this.explicitWidth ??
            minDefined(this.maxWidth, this.layoutAvailableWidth) ??
            naturalWidth;
        const totalWidth =
            this.layoutAssignedWidth ??
            this.explicitWidth ??
            Math.min(boundedOuter, naturalWidth);

        const contentHeight = Math.max(...children.map(c => c.height));
        const totalHeight =
            this.layoutAssignedHeight ??
            this.explicitHeight ??
            (this.padding * 2 + contentHeight);

        this.width = totalWidth;
        this.height = totalHeight;

        const innerLeft = this.x - totalWidth / 2 + this.padding;
        const innerTop = this.y - totalHeight / 2 + this.padding;
        const innerWidth = Math.max(0, totalWidth - this.padding * 2);
        const innerHeight = Math.max(0, totalHeight - this.padding * 2);
        const maximizedWidth = Math.max(
            0,
            innerWidth - this.gutter * (children.length - 1)
        ) / children.length;

        for (const measured of children) {
            const child = measured.child;
            if (this.align === LayoutAlign.STRETCH && child.layoutCanResizeMe) {
                this.setChildLayoutHeight(child, innerHeight);
            }
            if (child.maximizeX && child.layoutCanResizeMe) {
                this.setChildLayoutWidth(child, maximizedWidth);
            }
            if (child.maximizeY && child.layoutCanResizeMe) {
                this.setChildLayoutHeight(child, innerHeight);
            }
        }

        for (const measured of children) {
            measured.child.layoutForMeasurement();
        }

        let visualContentWidth = 0;
        for (const measured of children) {
            visualContentWidth += measured.child.getLayoutVisualWidth();
        }
        visualContentWidth += totalGutters;

        let extraSpacing = 0;
        let currentX = innerLeft;
        const availableSpace = innerWidth - visualContentWidth;
        const justify = this.resolveJustifyWithOverflow(availableSpace);
        if (justify === LayoutJustify.CENTER) {
            currentX += availableSpace / 2;
        } else if (justify === LayoutJustify.END) {
            currentX += availableSpace;
        } else if (
            justify === LayoutJustify.SPACE_BETWEEN &&
            children.length > 1
        ) {
            extraSpacing = Math.max(0, availableSpace / (children.length - 1));
        } else if (
            justify === LayoutJustify.SPACE_AROUND &&
            children.length > 1
        ) {
            extraSpacing = Math.max(0, availableSpace / children.length);
            currentX += extraSpacing / 2;
        }

        for (const measured of children) {
            const child = measured.child;
            const visualWidth = child.getLayoutVisualWidth();
            const visualHeight = child.getLayoutVisualHeight();

            let childY: number;
            if (this.align === LayoutAlign.START) {
                childY = innerTop + visualHeight / 2;
            } else if (this.align === LayoutAlign.END) {
                childY = innerTop + innerHeight - visualHeight / 2;
            } else {
                childY = innerTop + innerHeight / 2;
            }

            child.setLocation(
                currentX + visualWidth / 2 - child.getLayoutOffsetX(),
                childY - child.getLayoutOffsetY()
            );
            this.syncAttachOffset(child);

            currentX += visualWidth + this.gutter + extraSpacing;
        }
    }

    private layoutWrappedLines(children: LayoutChildMeasurement[]): void {
        const availableWidth = this.getBoundedInnerWidth() ?? Infinity;
        const lines = this.wrapChildren(children, availableWidth);

        const contentWidth = Math.max(...lines.map(line => line.width));
        const contentHeight =
            lines.reduce((sum, line) => sum + line.height, 0) +
            Math.max(0, lines.length - 1) * this.lineGap;

        const naturalWidth = this.padding * 2 + contentWidth;
        const boundedOuter =
            this.explicitWidth ??
            minDefined(this.maxWidth, this.layoutAvailableWidth) ??
            naturalWidth;
        this.width =
            this.layoutAssignedWidth ??
            this.explicitWidth ??
            Math.min(boundedOuter, naturalWidth);
        this.height =
            this.layoutAssignedHeight ??
            this.explicitHeight ??
            (this.padding * 2 + contentHeight);

        let lineTop = this.y - this.height / 2 + this.padding;
        for (const line of lines) {
            this.layoutLine(line, lineTop, this.width);
            lineTop += line.height + this.lineGap;
        }
    }

    private wrapChildren(
        children: LayoutChildMeasurement[],
        availableWidth: number
    ): RowLine[] {
        const lines: RowLine[] = [];
        let currentLine: RowLine | null = null;

        for (const measured of children) {
            if (currentLine && currentLine.children.length > 0) {
                const nextWidth =
                    currentLine.width + this.gutter + measured.width;
                if (nextWidth > availableWidth) {
                    lines.push(currentLine);
                    currentLine = null;
                }
            }

            if (!currentLine) {
                currentLine = { children: [], width: 0, height: 0 };
            }

            if (currentLine.children.length > 0) {
                currentLine.width += this.gutter;
            }
            currentLine.children.push(measured);
            currentLine.width += measured.width;
            currentLine.height = Math.max(currentLine.height, measured.height);
        }

        if (currentLine) {
            lines.push(currentLine);
        }
        return lines;
    }

    private layoutLine(
        line: RowLine,
        lineTop: number,
        totalWidth: number
    ): void {
        const innerWidth = Math.max(0, totalWidth - this.padding * 2);
        const innerLeft = this.x - totalWidth / 2 + this.padding;
        const justify = line.width > innerWidth
            ? LayoutJustify.START
            : this.justify;
        let extraSpacing = 0;
        let currentX = innerLeft;

        if (justify === LayoutJustify.CENTER) {
            currentX += (innerWidth - line.width) / 2;
        } else if (justify === LayoutJustify.END) {
            currentX += innerWidth - line.width;
        } else if (
            justify === LayoutJustify.SPACE_BETWEEN &&
            line.children.length > 1
        ) {
            extraSpacing = (innerWidth - line.width) / (line.children.length - 1);
        } else if (
            justify === LayoutJustify.SPACE_AROUND &&
            line.children.length > 1
        ) {
            extraSpacing = (innerWidth - line.width) / line.children.length;
            currentX += extraSpacing / 2;
        }

        for (const measured of line.children) {
            const child = measured.child;
            const visualWidth = child.getLayoutVisualWidth();
            const visualHeight = child.getLayoutVisualHeight();
            let centerY: number;
            if (this.align === LayoutAlign.START) {
                centerY = lineTop + visualHeight / 2;
            } else if (this.align === LayoutAlign.END) {
                centerY = lineTop + line.height - visualHeight / 2;
            } else {
                centerY = lineTop + line.height / 2;
            }

            child.setLocation(
                currentX + visualWidth / 2 - child.getLayoutOffsetX(),
                centerY - child.getLayoutOffsetY()
            );
            this.syncAttachOffset(child);

            currentX += visualWidth + this.gutter + extraSpacing;
        }
    }
}

/**
 * Vertical layout container.
 */
export class Column extends LayoutContainer {
    constructor(x: number, y: number) {
        super(x, y);
        this.layoutCanResizeMe = true;
    }

    protected override performLayout(): void {
        for (const child of this.children) {
            child.restoreLayoutIntrinsicSize();
        }
        const children = this.measureChildren();
        if (children.length === 0) {
            this.height = this.layoutAssignedHeight ?? this.explicitHeight ?? 0;
            this.width = this.layoutAssignedWidth ?? this.explicitWidth ?? 0;
            return;
        }

        const totalChildrenHeight = children.reduce((sum, c) => sum + c.height, 0);
        const totalGutters = Math.max(0, children.length - 1) * this.gutter;
        const contentHeight = totalChildrenHeight + totalGutters;
        const naturalHeight = this.padding * 2 + contentHeight;
        const boundedOuterHeight =
            this.explicitHeight ??
            this.layoutAvailableHeight ??
            naturalHeight;
        const totalHeight =
            this.layoutAssignedHeight ??
            this.explicitHeight ??
            Math.min(boundedOuterHeight, naturalHeight);

        const contentWidth = Math.max(...children.map(c => c.width));
        const naturalWidth = this.padding * 2 + contentWidth;
        const boundedOuterWidth =
            this.explicitWidth ??
            minDefined(this.maxWidth, this.layoutAvailableWidth) ??
            naturalWidth;
        const totalWidth =
            this.layoutAssignedWidth ??
            this.explicitWidth ??
            Math.min(boundedOuterWidth, naturalWidth);

        this.width = totalWidth;
        this.height = totalHeight;

        const innerLeft = this.x - totalWidth / 2 + this.padding;
        const innerTop = this.y - totalHeight / 2 + this.padding;
        const innerWidth = Math.max(0, totalWidth - this.padding * 2);
        const innerHeight = Math.max(0, totalHeight - this.padding * 2);
        const maximizedHeight = Math.max(
            0,
            innerHeight - this.gutter * (children.length - 1)
        ) / children.length;

        for (const measured of children) {
            const child = measured.child;
            if (this.align === LayoutAlign.STRETCH && child.layoutCanResizeMe) {
                this.setChildLayoutWidth(child, innerWidth);
            }
            if (child.maximizeX && child.layoutCanResizeMe) {
                this.setChildLayoutWidth(child, innerWidth);
            }
            if (child.maximizeY && child.layoutCanResizeMe) {
                this.setChildLayoutHeight(child, maximizedHeight);
            }
        }

        for (const measured of children) {
            measured.child.layoutForMeasurement();
        }

        let visualContentHeight = 0;
        for (const measured of children) {
            visualContentHeight += measured.child.getLayoutVisualHeight();
        }
        visualContentHeight += totalGutters;

        let extraSpacing = 0;
        let currentY = innerTop;
        const availableSpace = innerHeight - visualContentHeight;
        const justify = this.resolveJustifyWithOverflow(availableSpace);
        if (justify === LayoutJustify.CENTER) {
            currentY += availableSpace / 2;
        } else if (justify === LayoutJustify.END) {
            currentY += availableSpace;
        } else if (
            justify === LayoutJustify.SPACE_BETWEEN &&
            children.length > 1
        ) {
            extraSpacing = Math.max(0, availableSpace / (children.length - 1));
        } else if (
            justify === LayoutJustify.SPACE_AROUND &&
            children.length > 1
        ) {
            extraSpacing = Math.max(0, availableSpace / children.length);
            currentY += extraSpacing / 2;
        }

        for (const measured of children) {
            const child = measured.child;
            const visualWidth = child.getLayoutVisualWidth();
            const visualHeight = child.getLayoutVisualHeight();

            let childX: number;
            if (this.align === LayoutAlign.START) {
                childX = innerLeft + visualWidth / 2;
            } else if (this.align === LayoutAlign.END) {
                childX = innerLeft + innerWidth - visualWidth / 2;
            } else {
                childX = innerLeft + innerWidth / 2;
            }

            child.setLocation(
                childX - child.getLayoutOffsetX(),
                currentY + visualHeight / 2 - child.getLayoutOffsetY()
            );
            this.syncAttachOffset(child);

            currentY += visualHeight + this.gutter + extraSpacing;
        }
    }
}

/**
 * Board-space border layout with top, bottom, left, right, and centre regions.
 */
export class Page extends GameObject {
    topRow?: Row;
    bottomRow?: Row;
    leftColumn?: Column;
    rightColumn?: Column;
    centerColumn: Column;
    layoutDirty: boolean = true;

    constructor(x: number, y: number) {
        const pageClass = new GameObjectClass("page", null, null);
        super(pageClass, x, y);
        this.width = boardWidth;
        this.height = boardHeight;
        this.layoutCanResizeMe = false;
        this.destroyAttachedOnDestroy = true;

        this.centerColumn = new Column(x, y);
        this.centerColumn.setSize(boardWidth, boardHeight);
        this.attach(this.centerColumn, 0, 0, 0);
        gameObjects.add(this);
        registerLayoutParticipant(this);
    }

    override invalidateLayout(): void {
        this.layoutDirty = true;
        super.invalidateLayout();
    }

    override onAttachedParentMoved(): void {
        this.updateAttached();
    }

    override destroy(): void {
        unregisterLayoutParticipant(this);
        super.destroy();
    }

    override onChildDestroyed(child: GameObject): void {
        if (this.topRow === child) this.topRow = undefined;
        if (this.bottomRow === child) this.bottomRow = undefined;
        if (this.leftColumn === child) this.leftColumn = undefined;
        if (this.rightColumn === child) this.rightColumn = undefined;
        if (this.centerColumn === child && !this.destroyed) {
            this.centerColumn = new Column(this.x, this.y);
            this.centerColumn.setSize(boardWidth, boardHeight);
            this.attach(this.centerColumn, 0, 0, 0);
        }
        super.onChildDestroyed(child);
        if (!this.destroyed) {
            this.invalidateLayout();
        }
    }

    draw(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
        // Page is a layout owner; its regions and center draw themselves.
    }

    layout(): void {
        this.layoutDirty = false;
        this.performLayout();
        this.layoutDirty = false;
    }

    protected performLayout(): void {
        this.width = boardWidth;
        this.height = boardHeight;
        const topRow = this.topRow?.visible ? this.topRow : undefined;
        const bottomRow = this.bottomRow?.visible ? this.bottomRow : undefined;
        const leftColumn = this.leftColumn?.visible ? this.leftColumn : undefined;
        const rightColumn = this.rightColumn?.visible ? this.rightColumn : undefined;

        let topHeight = 0;
        if (topRow) {
            topRow.setAvailableWidth(boardWidth);
            topRow.layout();
            topHeight = topRow.height;
        }

        let bottomHeight = 0;
        if (bottomRow) {
            bottomRow.setAvailableWidth(boardWidth);
            bottomRow.layout();
            bottomHeight = bottomRow.height;
        }

        const middleHeight = Math.max(0, boardHeight - topHeight - bottomHeight);
        const middleCenterY = this.y - boardHeight / 2 + topHeight + middleHeight / 2;
        const innerLeft = this.x - boardWidth / 2;

        let leftWidth = 0;
        if (leftColumn) {
            leftColumn.setAvailableHeight(middleHeight);
            leftColumn.layout();
            leftWidth = leftColumn.width;
        }

        let rightWidth = 0;
        if (rightColumn) {
            rightColumn.setAvailableHeight(middleHeight);
            rightColumn.layout();
            rightWidth = rightColumn.width;
        }

        const centerWidth = Math.max(0, boardWidth - leftWidth - rightWidth);
        const centerX = innerLeft + leftWidth + centerWidth / 2;

        if (topRow) {
            topRow.setLocation(this.x, this.y - boardHeight / 2 + topHeight / 2);
            syncAttachOffsetFor(this, topRow);
        }
        if (bottomRow) {
            bottomRow.setLocation(this.x, this.y + boardHeight / 2 - bottomHeight / 2);
            syncAttachOffsetFor(this, bottomRow);
        }
        if (leftColumn) {
            leftColumn.setLocation(innerLeft + leftWidth / 2, middleCenterY);
            syncAttachOffsetFor(this, leftColumn);
        }
        if (rightColumn) {
            rightColumn.setLocation(this.x + boardWidth / 2 - rightWidth / 2, middleCenterY);
            syncAttachOffsetFor(this, rightColumn);
        }

        this.centerColumn.setLocation(centerX, middleCenterY);
        this.centerColumn.setSize(centerWidth, middleHeight);
        this.centerColumn.layout();
        syncAttachOffsetFor(this, this.centerColumn);
    }

    setTopRow(row: Row) {
        if (this.topRow === row) {
            this.topRow.setVisible(true);
            return;
        }
        if (this.topRow) {
            const old = this.topRow;
            this.topRow = undefined;
            this.detach(old);
            old.setVisible(false);
        }
        this.topRow = row;
        this.attach(row, 0, 0, 0);
        row.setVisible(true);
        this.invalidateLayout();
    }

    setBottomRow(row: Row) {
        if (this.bottomRow === row) {
            this.bottomRow.setVisible(true);
            return;
        }
        if (this.bottomRow) {
            const old = this.bottomRow;
            this.bottomRow = undefined;
            this.detach(old);
            old.setVisible(false);
        }
        this.bottomRow = row;
        this.attach(row, 0, 0, 0);
        row.setVisible(true);
        this.invalidateLayout();
    }

    setLeftColumn(column: Column) {
        if (this.leftColumn === column) {
            this.leftColumn.setVisible(true);
            return;
        }
        if (this.leftColumn) {
            const old = this.leftColumn;
            this.leftColumn = undefined;
            this.detach(old);
            old.setVisible(false);
        }
        this.leftColumn = column;
        this.attach(column, 0, 0, 0);
        column.setVisible(true);
        this.invalidateLayout();
    }

    setRightColumn(column: Column) {
        if (this.rightColumn === column) {
            this.rightColumn.setVisible(true);
            return;
        }
        if (this.rightColumn) {
            const old = this.rightColumn;
            this.rightColumn = undefined;
            this.detach(old);
            old.setVisible(false);
        }
        this.rightColumn = column;
        this.attach(column, 0, 0, 0);
        column.setVisible(true);
        this.invalidateLayout();
    }
}

/**
 * Board-space scrollable border layout.
 */
export class ScrollablePage extends GameObject {
    topRow?: Row;
    bottomRow?: Row;
    leftColumn?: Column;
    rightColumn?: Column;
    centerColumn: Column;
    scrollOffset: number = 0;
    scrollbar?: GameObject;
    contentHeight: number = 0;
    layoutDirty: boolean = true;

    constructor(x: number, y: number) {
        const scrollablePageClass = new GameObjectClass("scrollable-page", null, null);
        super(scrollablePageClass, x, y);
        this.width = boardWidth;
        this.height = boardHeight;
        this.layoutCanResizeMe = false;
        this.destroyAttachedOnDestroy = true;

        this.centerColumn = new Column(x, y);
        this.centerColumn.setSize(boardWidth, boardHeight);
        this.attach(this.centerColumn, 0, 0, 0);
        gameObjects.add(this);
        registerLayoutParticipant(this);
    }

    override invalidateLayout(): void {
        this.layoutDirty = true;
        super.invalidateLayout();
    }

    override onAttachedParentMoved(): void {
        this.updateAttached();
    }

    override destroy(): void {
        unregisterLayoutParticipant(this);
        super.destroy();
    }

    override onChildDestroyed(child: GameObject): void {
        if (this.topRow === child) this.topRow = undefined;
        if (this.bottomRow === child) this.bottomRow = undefined;
        if (this.leftColumn === child) this.leftColumn = undefined;
        if (this.rightColumn === child) this.rightColumn = undefined;
        if (this.centerColumn === child && !this.destroyed) {
            this.centerColumn = new Column(this.x, this.y);
            this.centerColumn.setSize(boardWidth, boardHeight);
            this.attach(this.centerColumn, 0, 0, 0);
        }
        super.onChildDestroyed(child);
        if (!this.destroyed) {
            this.invalidateLayout();
        }
    }

    draw(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
        // ScrollablePage is a layout owner; its regions and center draw themselves.
    }

    layout(): void {
        this.layoutDirty = false;
        this.performLayout();
        this.layoutDirty = false;
    }

    protected performLayout(): void {
        this.width = boardWidth;
        this.height = boardHeight;
        const topRow = this.topRow?.visible ? this.topRow : undefined;
        const bottomRow = this.bottomRow?.visible ? this.bottomRow : undefined;
        const leftColumn = this.leftColumn?.visible ? this.leftColumn : undefined;
        const rightColumn = this.rightColumn?.visible ? this.rightColumn : undefined;

        let topHeight = 0;
        if (topRow) {
            topRow.setAvailableWidth(boardWidth);
            topRow.layout();
            topHeight = topRow.height;
        }

        let bottomHeight = 0;
        if (bottomRow) {
            bottomRow.setAvailableWidth(boardWidth);
            bottomRow.layout();
            bottomHeight = bottomRow.height;
        }

        const viewportHeight = Math.max(0, boardHeight - topHeight - bottomHeight);
        const middleCenterY = this.y - boardHeight / 2 + topHeight + viewportHeight / 2;
        const innerLeft = this.x - boardWidth / 2;

        let leftWidth = 0;
        if (leftColumn) {
            leftColumn.setAvailableHeight(viewportHeight);
            leftColumn.layout();
            leftWidth = leftColumn.width;
        }

        let rightWidth = 0;
        if (rightColumn) {
            rightColumn.setAvailableHeight(viewportHeight);
            rightColumn.layout();
            rightWidth = rightColumn.width;
        }

        const centerWidth = Math.max(0, boardWidth - leftWidth - rightWidth);
        const centerX = innerLeft + leftWidth + centerWidth / 2;
        const centerHeight = Math.max(this.contentHeight, viewportHeight);
        const maxScroll = Math.max(0, centerHeight - viewportHeight);
        this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset));

        if (topRow) {
            topRow.setLocation(this.x, this.y - boardHeight / 2 + topHeight / 2);
            syncAttachOffsetFor(this, topRow);
        }
        if (bottomRow) {
            bottomRow.setLocation(this.x, this.y + boardHeight / 2 - bottomHeight / 2);
            syncAttachOffsetFor(this, bottomRow);
        }
        if (leftColumn) {
            leftColumn.setLocation(innerLeft + leftWidth / 2, middleCenterY);
            syncAttachOffsetFor(this, leftColumn);
        }
        if (rightColumn) {
            rightColumn.setLocation(this.x + boardWidth / 2 - rightWidth / 2, middleCenterY);
            syncAttachOffsetFor(this, rightColumn);
        }

        const viewportTop = this.y - boardHeight / 2 + topHeight;
        const centerY = viewportTop + centerHeight / 2 - this.scrollOffset;
        this.centerColumn.setSize(centerWidth, centerHeight);
        this.centerColumn.setLocation(centerX, centerY);
        this.centerColumn.layout();
        syncAttachOffsetFor(this, this.centerColumn);
    }

    setTopRow(row: Row) {
        if (this.topRow === row) {
            this.topRow.setVisible(true);
            return;
        }
        if (this.topRow) {
            const old = this.topRow;
            this.topRow = undefined;
            this.detach(old);
            old.setVisible(false);
        }
        this.topRow = row;
        this.attach(row, 0, 0, 0);
        row.setVisible(true);
        this.invalidateLayout();
    }

    setBottomRow(row: Row) {
        if (this.bottomRow === row) {
            this.bottomRow.setVisible(true);
            return;
        }
        if (this.bottomRow) {
            const old = this.bottomRow;
            this.bottomRow = undefined;
            this.detach(old);
            old.setVisible(false);
        }
        this.bottomRow = row;
        this.attach(row, 0, 0, 0);
        row.setVisible(true);
        this.invalidateLayout();
    }

    setLeftColumn(column: Column) {
        if (this.leftColumn === column) {
            this.leftColumn.setVisible(true);
            return;
        }
        if (this.leftColumn) {
            const old = this.leftColumn;
            this.leftColumn = undefined;
            this.detach(old);
            old.setVisible(false);
        }
        this.leftColumn = column;
        this.attach(column, 0, 0, 0);
        column.setVisible(true);
        this.invalidateLayout();
    }

    setRightColumn(column: Column) {
        if (this.rightColumn === column) {
            this.rightColumn.setVisible(true);
            return;
        }
        if (this.rightColumn) {
            const old = this.rightColumn;
            this.rightColumn = undefined;
            this.detach(old);
            old.setVisible(false);
        }
        this.rightColumn = column;
        this.attach(column, 0, 0, 0);
        column.setVisible(true);
        this.invalidateLayout();
    }

    setContentHeight(height: number) {
        this.contentHeight = height;
        this.invalidateLayout();
    }

    scroll(delta: number) {
        const topHeight = this.topRow?.visible ? this.topRow.height : 0;
        const bottomHeight = this.bottomRow?.visible ? this.bottomRow.height : 0;
        const viewportHeight = Math.max(0, boardHeight - topHeight - bottomHeight);
        const centerHeight = Math.max(this.contentHeight, viewportHeight);
        const maxScroll = Math.max(0, centerHeight - viewportHeight);
        this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset + delta));
        this.invalidateLayout();
    }
}

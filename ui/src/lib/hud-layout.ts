import { GameObject } from "./gameclasses";
import { LayoutContainer } from "./layout";
import { getHudSize } from "./simplegame";

/**
 * Viewport-relative HUD border layout.
 *
 * The root is automatically sized to the default-zoom viewport and centred in
 * it. Top and bottom regions are given the full inner width and auto-size their
 * height. Left and right regions are given the remaining height and auto-size
 * their width. The centre region receives the remaining rectangle.
 *
 * All descendants inherit HUD rendering and input through `attachedTo`.
 */
export class HudLayout extends LayoutContainer {
    top?: LayoutContainer;
    bottom?: LayoutContainer;
    left?: LayoutContainer;
    right?: LayoutContainer;
    center: LayoutContainer;
    inset: number = 0;
    regionGap: number = 0;

    constructor(x: number = getHudSize().width / 2, y: number = getHudSize().height / 2) {
        super(x, y);
        this.hud = true;
        this.layoutCanResizeMe = false;
        this.center = new LayoutContainer(x, y);
        this.attach(this.center, 0, 0, 0);
    }

    setTop(region: LayoutContainer | null): void {
        if (this.top === (region ?? undefined)) {
            this.top?.setVisible(true);
            return;
        }
        if (this.top) {
            const old = this.top;
            this.top = undefined;
            this.detach(old);
            old.setVisible(false);
        }
        this.top = region ?? undefined;
        if (this.top) {
            this.attach(this.top, 0, 0, 0);
            this.top.setVisible(true);
        }
        this.invalidateLayout();
    }

    setBottom(region: LayoutContainer | null): void {
        if (this.bottom === (region ?? undefined)) {
            this.bottom?.setVisible(true);
            return;
        }
        if (this.bottom) {
            const old = this.bottom;
            this.bottom = undefined;
            this.detach(old);
            old.setVisible(false);
        }
        this.bottom = region ?? undefined;
        if (this.bottom) {
            this.attach(this.bottom, 0, 0, 0);
            this.bottom.setVisible(true);
        }
        this.invalidateLayout();
    }

    setLeft(region: LayoutContainer | null): void {
        if (this.left === (region ?? undefined)) {
            this.left?.setVisible(true);
            return;
        }
        if (this.left) {
            const old = this.left;
            this.left = undefined;
            this.detach(old);
            old.setVisible(false);
        }
        this.left = region ?? undefined;
        if (this.left) {
            this.attach(this.left, 0, 0, 0);
            this.left.setVisible(true);
        }
        this.invalidateLayout();
    }

    setRight(region: LayoutContainer | null): void {
        if (this.right === (region ?? undefined)) {
            this.right?.setVisible(true);
            return;
        }
        if (this.right) {
            const old = this.right;
            this.right = undefined;
            this.detach(old);
            old.setVisible(false);
        }
        this.right = region ?? undefined;
        if (this.right) {
            this.attach(this.right, 0, 0, 0);
            this.right.setVisible(true);
        }
        this.invalidateLayout();
    }

    setCenter(region: LayoutContainer): void {
        if (this.center === region) {
            this.center.setVisible(true);
            return;
        }
        const old = this.center;
        this.detach(old);
        old.setVisible(false);
        this.center = region;
        this.attach(this.center, 0, 0, 0);
        this.center.setVisible(true);
        this.invalidateLayout();
    }

    override onChildDestroyed(child: GameObject): void {
        if (this.top === child) this.top = undefined;
        if (this.bottom === child) this.bottom = undefined;
        if (this.left === child) this.left = undefined;
        if (this.right === child) this.right = undefined;
        if (this.center === child && !this.destroyed) {
            this.center = new LayoutContainer(this.x, this.y);
            this.attach(this.center, 0, 0, 0);
        }
        super.onChildDestroyed(child);
    }

    setInset(inset: number): void {
        this.inset = inset;
        this.invalidateLayout();
    }

    setRegionGap(gap: number): void {
        this.regionGap = gap;
        this.invalidateLayout();
    }

    protected override performLayout(): void {
        const size = getHudSize();
        this.width = size.width;
        this.height = size.height;
        this.setLocation(size.width / 2, size.height / 2);

        const innerWidth = Math.max(0, size.width - this.inset * 2);
        const innerHeight = Math.max(0, size.height - this.inset * 2);
        const innerLeft = this.x - innerWidth / 2;
        const innerTop = this.y - innerHeight / 2;

        const top = this.top?.visible ? this.top : undefined;
        const bottom = this.bottom?.visible ? this.bottom : undefined;
        const left = this.left?.visible ? this.left : undefined;
        const right = this.right?.visible ? this.right : undefined;

        let topHeight = 0;
        if (top) {
            top.setAvailableWidth(innerWidth);
            top.layout();
            topHeight = top.height;
            top.setLocation(this.x, innerTop + topHeight / 2);
            this.syncAttachOffset(top);
        }

        let bottomHeight = 0;
        if (bottom) {
            bottom.setAvailableWidth(innerWidth);
            bottom.layout();
            bottomHeight = bottom.height;
            bottom.setLocation(
                this.x,
                this.y + innerHeight / 2 - bottomHeight / 2
            );
            this.syncAttachOffset(bottom);
        }

        const topGap = top ? this.regionGap : 0;
        const bottomGap = bottom ? this.regionGap : 0;
        const middleTop = innerTop + topHeight + topGap;
        const middleHeight = Math.max(
            0,
            innerHeight - topHeight - bottomHeight - topGap - bottomGap
        );
        const middleCenterY = middleTop + middleHeight / 2;

        let leftWidth = 0;
        if (left) {
            left.setAvailableHeight(middleHeight);
            left.layout();
            leftWidth = left.width;
            left.setLocation(innerLeft + leftWidth / 2, middleCenterY);
            this.syncAttachOffset(left);
        }

        let rightWidth = 0;
        if (right) {
            right.setAvailableHeight(middleHeight);
            right.layout();
            rightWidth = right.width;
            right.setLocation(
                this.x + innerWidth / 2 - rightWidth / 2,
                middleCenterY
            );
            this.syncAttachOffset(right);
        }

        const leftGap = left ? this.regionGap : 0;
        const rightGap = right ? this.regionGap : 0;
        const centerLeft = innerLeft + leftWidth + leftGap;
        const centerWidth = Math.max(
            0,
            innerWidth - leftWidth - rightWidth - leftGap - rightGap
        );
        const centerX = centerLeft + centerWidth / 2;

        this.center.setSize(centerWidth, middleHeight);
        this.center.setLocation(centerX, middleCenterY);
        this.center.layout();
        this.syncAttachOffset(this.center);
    }
}

import { GameObject, GameObjectClass } from "./gameclasses";
import { boardWidth, boardHeight } from "./simplegame";

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

export class LayoutContainer extends GameObject {
    children: GameObject[] = [];
    padding: number = 0;
    justify: LayoutJustify = LayoutJustify.START;
    align: LayoutAlign = LayoutAlign.START;
    explicitWidth?: number;
    explicitHeight?: number;

    constructor(x: number, y: number) {
        // Create a temporary game class for layout containers
        const layoutClass = new GameObjectClass("layout-container", null, null);
        super(layoutClass, x, y);
        this.layoutCanResizeMe = false; // Containers manage their own sizing
    }

    addChild(child: GameObject) {
        this.children.push(child);
        // Attach child to this container
        this.attach(child, 0, 0, 0);
    }

    removeChild(child: GameObject) {
        const index = this.children.indexOf(child);
        if (index > -1) {
            this.children.splice(index, 1);
            this.detach(child);
        }
    }

    setPadding(padding: number) {
        this.padding = padding;
        this.layout();
    }

    setJustify(justify: LayoutJustify) {
        this.justify = justify;
        this.layout();
    }

    setAlign(align: LayoutAlign) {
        this.align = align;
        this.layout();
    }

    setSize(width: number, height: number) {
        this.explicitWidth = width;
        this.explicitHeight = height;
        this.width = width;
        this.height = height;
        this.layout();
    }

    // Override to implement specific layout logic
    layout() {
        // To be implemented by subclasses
    }

    getContentWidth(): number {
        return this.children.reduce((max, child) => Math.max(max, child.x + child.width / 2), 0) -
               this.children.reduce((min, child) => Math.min(min, child.x - child.width / 2), 0);
    }

    getContentHeight(): number {
        return this.children.reduce((max, child) => Math.max(max, child.y + child.height / 2), 0) -
               this.children.reduce((min, child) => Math.min(min, child.y - child.height / 2), 0);
    }
}

export class Row extends LayoutContainer {
    layout() {
        if (this.children.length === 0) return;

        const totalWidth = this.explicitWidth || this.getContentWidth();
        const totalHeight = this.explicitHeight || Math.max(...this.children.map(c => c.height));

        this.width = totalWidth;
        this.height = totalHeight;

        let currentX = this.x - totalWidth / 2 + this.padding;
        const startY = this.y;

        // Calculate spacing based on justify
        let spacing = 0;
        if (this.justify === LayoutJustify.SPACE_BETWEEN && this.children.length > 1) {
            const availableSpace = totalWidth - this.padding * 2 - this.children.reduce((sum, c) => sum + c.width, 0);
            spacing = availableSpace / (this.children.length - 1);
        } else if (this.justify === LayoutJustify.SPACE_AROUND && this.children.length > 1) {
            const availableSpace = totalWidth - this.padding * 2 - this.children.reduce((sum, c) => sum + c.width, 0);
            spacing = availableSpace / this.children.length;
            currentX += spacing / 2;
        }

        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];

            // Position child horizontally based on justify
            if (this.justify === LayoutJustify.CENTER) {
                // Center all children as a group
                const groupWidth = this.children.reduce((sum, c) => sum + c.width, 0) + (this.children.length - 1) * this.padding;
                currentX = this.x - groupWidth / 2;
                for (let j = 0; j <= i; j++) {
                    if (j > 0) currentX += this.children[j-1].width + this.padding;
                }
            } else if (this.justify === LayoutJustify.END) {
                currentX = this.x + totalWidth / 2 - this.padding - child.width;
                for (let j = this.children.length - 1; j > i; j--) {
                    currentX -= this.children[j].width + this.padding;
                }
            } else {
                // START, SPACE_BETWEEN, SPACE_AROUND
                if (i > 0) currentX += this.children[i-1].width + this.padding + spacing;
            }

            // Position child vertically based on align
            let childY = startY;
            if (this.align === LayoutAlign.CENTER) {
                childY = startY;
            } else if (this.align === LayoutAlign.END) {
                childY = startY + totalHeight / 2 - child.height / 2;
            } else if (this.align === LayoutAlign.STRETCH && child.layoutCanResizeMe) {
                child.height = totalHeight;
                childY = startY;
            }

            // Handle maximize flags
            if (child.maximizeX && child.layoutCanResizeMe) {
                child.width = totalWidth / this.children.length;
            }
            if (child.maximizeY && child.layoutCanResizeMe) {
                child.height = totalHeight;
            }

            child.setLocation(currentX + child.width / 2, childY);
        }
    }
}

export class Column extends LayoutContainer {
    layout() {
        if (this.children.length === 0) return;

        const totalHeight = this.explicitHeight || this.getContentHeight();
        const totalWidth = this.explicitWidth || Math.max(...this.children.map(c => c.width));

        this.width = totalWidth;
        this.height = totalHeight;

        const startX = this.x;
        let currentY = this.y - totalHeight / 2 + this.padding;

        // Calculate spacing based on justify
        let spacing = 0;
        if (this.justify === LayoutJustify.SPACE_BETWEEN && this.children.length > 1) {
            const availableSpace = totalHeight - this.padding * 2 - this.children.reduce((sum, c) => sum + c.height, 0);
            spacing = availableSpace / (this.children.length - 1);
        } else if (this.justify === LayoutJustify.SPACE_AROUND && this.children.length > 1) {
            const availableSpace = totalHeight - this.padding * 2 - this.children.reduce((sum, c) => sum + c.height, 0);
            spacing = availableSpace / this.children.length;
            currentY += spacing / 2;
        }

        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];

            // Position child vertically based on justify
            if (this.justify === LayoutJustify.CENTER) {
                // Center all children as a group
                const groupHeight = this.children.reduce((sum, c) => sum + c.height, 0) + (this.children.length - 1) * this.padding;
                currentY = this.y - groupHeight / 2;
                for (let j = 0; j <= i; j++) {
                    if (j > 0) currentY += this.children[j-1].height + this.padding;
                }
            } else if (this.justify === LayoutJustify.END) {
                currentY = this.y + totalHeight / 2 - this.padding - child.height;
                for (let j = this.children.length - 1; j > i; j--) {
                    currentY -= this.children[j].height + this.padding;
                }
            } else {
                // START, SPACE_BETWEEN, SPACE_AROUND
                if (i > 0) currentY += this.children[i-1].height + this.padding + spacing;
            }

            // Position child horizontally based on align
            let childX = startX;
            if (this.align === LayoutAlign.CENTER) {
                childX = startX;
            } else if (this.align === LayoutAlign.END) {
                childX = startX + totalWidth / 2 - child.width / 2;
            } else if (this.align === LayoutAlign.STRETCH && child.layoutCanResizeMe) {
                child.width = totalWidth;
                childX = startX;
            }

            // Handle maximize flags
            if (child.maximizeX && child.layoutCanResizeMe) {
                child.width = totalWidth;
            }
            if (child.maximizeY && child.layoutCanResizeMe) {
                child.height = totalHeight / this.children.length;
            }

            child.setLocation(childX, currentY + child.height / 2);
        }
    }
}

export class Page extends GameObject {
    topRow?: Row;
    bottomRow?: Row;
    leftColumn?: Column;
    rightColumn?: Column;
    centerColumn: Column;

    constructor(x: number, y: number) {
        // Create a temporary game class for pages
        const pageClass = new GameObjectClass("page", null, null);
        super(pageClass, x, y);
        this.width = boardWidth;
        this.height = boardHeight;
        this.layoutCanResizeMe = false;

        // Create center column
        this.centerColumn = new Column(x, y);
        this.centerColumn.setSize(boardWidth, boardHeight);
        this.attach(this.centerColumn, 0, 0, 0);
    }

    setTopRow(row: Row) {
        if (this.topRow) {
            this.detach(this.topRow);
        }
        this.topRow = row;
        this.attach(row, 0, -boardHeight / 2 + row.height / 2, 0);
        this.layout();
    }

    setBottomRow(row: Row) {
        if (this.bottomRow) {
            this.detach(this.bottomRow);
        }
        this.bottomRow = row;
        this.attach(row, 0, boardHeight / 2 - row.height / 2, 0);
        this.layout();
    }

    setLeftColumn(column: Column) {
        if (this.leftColumn) {
            this.detach(this.leftColumn);
        }
        this.leftColumn = column;
        this.attach(column, -boardWidth / 2 + column.width / 2, 0, 0);
        this.layout();
    }

    setRightColumn(column: Column) {
        if (this.rightColumn) {
            this.detach(this.rightColumn);
        }
        this.rightColumn = column;
        this.attach(column, boardWidth / 2 - column.width / 2, 0, 0);
        this.layout();
    }

    private layout() {
        // Adjust center column size based on other elements
        let centerX = 0;
        let centerY = 0;
        let centerWidth = boardWidth;
        let centerHeight = boardHeight;

        if (this.topRow) {
            centerY += this.topRow.height / 2;
            centerHeight -= this.topRow.height;
        }
        if (this.bottomRow) {
            centerY -= this.bottomRow.height / 2;
            centerHeight -= this.bottomRow.height;
        }
        if (this.leftColumn) {
            centerX += this.leftColumn.width / 2;
            centerWidth -= this.leftColumn.width;
        }
        if (this.rightColumn) {
            centerX -= this.rightColumn.width / 2;
            centerWidth -= this.rightColumn.width;
        }

        this.centerColumn.setLocation(this.x + centerX, this.y + centerY);
        this.centerColumn.setSize(Math.max(0, centerWidth), Math.max(0, centerHeight));
    }
}

export class ScrollablePage extends GameObject {
    topRow?: Row;
    bottomRow?: Row;
    leftColumn?: Column;
    rightColumn?: Column;
    centerColumn: Column;
    scrollOffset: number = 0;
    scrollbar?: GameObject;

    constructor(x: number, y: number) {
        // Create a temporary game class for scrollable pages
        const scrollablePageClass = new GameObjectClass("scrollable-page", null, null);
        super(scrollablePageClass, x, y);
        this.width = boardWidth;
        this.height = boardHeight;
        this.layoutCanResizeMe = false;

        // Create center column (can be larger than screen)
        this.centerColumn = new Column(x, y);
        this.attach(this.centerColumn, 0, 0, 0);
    }

    setTopRow(row: Row) {
        if (this.topRow) {
            this.detach(this.topRow);
        }
        this.topRow = row;
        this.attach(row, 0, -boardHeight / 2 + row.height / 2, 0);
    }

    setBottomRow(row: Row) {
        if (this.bottomRow) {
            this.detach(this.bottomRow);
        }
        this.bottomRow = row;
        this.attach(row, 0, boardHeight / 2 - row.height / 2, 0);
    }

    setLeftColumn(column: Column) {
        if (this.leftColumn) {
            this.detach(this.leftColumn);
        }
        this.leftColumn = column;
        this.attach(column, -boardWidth / 2 + column.width / 2, 0, 0);
    }

    setRightColumn(column: Column) {
        if (this.rightColumn) {
            this.detach(this.rightColumn);
        }
        this.rightColumn = column;
        this.attach(column, boardWidth / 2 - column.width / 2, 0, 0);
    }

    setContentHeight(height: number) {
        this.centerColumn.setSize(boardWidth, height);
        // TODO: Add scrollbar implementation
    }

    scroll(delta: number) {
        this.scrollOffset += delta;
        // Clamp scroll offset
        const maxScroll = Math.max(0, this.centerColumn.height - boardHeight);
        this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset));

        // Update center column position
        this.centerColumn.setLocation(this.x, this.y - this.scrollOffset);
    }
}
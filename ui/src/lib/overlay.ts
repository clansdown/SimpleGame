import type { Position2D } from "./util";

function crossProduct(a: Position2D, b: Position2D, c: Position2D): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function polygonArea(vertices: Position2D[]): number {
    let area = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += vertices[i].x * vertices[j].y;
        area -= vertices[j].x * vertices[i].y;
    }
    return area / 2;
}

function isClockwise(vertices: Position2D[]): boolean {
    return polygonArea(vertices) < 0;
}

function pointInTriangle(p: Position2D, a: Position2D, b: Position2D, c: Position2D): boolean {
    const d1 = crossProduct(p, a, b);
    const d2 = crossProduct(p, b, c);
    const d3 = crossProduct(p, c, a);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
}

function pointInPolygon(p: Position2D, vertices: Position2D[]): boolean {
    let inside = false;
    const n = vertices.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;
        if ((yi > p.y) !== (yj > p.y) &&
            p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

function distance(a: Position2D, b: Position2D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function segmentsIntersect(p1: Position2D, q1: Position2D, p2: Position2D, q2: Position2D): boolean {
    const o1 = crossProduct(p1, q1, p2);
    const o2 = crossProduct(p1, q1, q2);
    const o3 = crossProduct(p2, q2, p1);
    const o4 = crossProduct(p2, q2, q1);

    if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0) {
        return false;
    }

    return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function segmentVisible(h: Position2D, v: Position2D, outer: Position2D[], holes: Position2D[][]): boolean {
    const n = outer.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        if (outer[i] === v || outer[j] === v) continue;
        if (outer[i] === h || outer[j] === h) continue;
        if (segmentsIntersect(h, v, outer[i], outer[j])) {
            return false;
        }
    }
    for (const hole of holes) {
        const m = hole.length;
        for (let i = 0; i < m; i++) {
            const j = (i + 1) % m;
            if (hole[i] === h || hole[j] === h) continue;
            if (hole[i] === v || hole[j] === v) continue;
            if (segmentsIntersect(h, v, hole[i], hole[j])) {
                return false;
            }
        }
    }
    const mid: Position2D = { x: (h.x + v.x) / 2, y: (h.y + v.y) / 2 };
    if (!pointInPolygon(mid, outer)) return false;
    for (const hole of holes) {
        if (pointInPolygon(mid, hole)) return false;
    }
    return true;
}

function isEar(vertices: Position2D[], prevIdx: number, currIdx: number, nextIdx: number, activeIndices: number[]): boolean {
    const a = vertices[prevIdx];
    const b = vertices[currIdx];
    const c = vertices[nextIdx];

    if (crossProduct(a, b, c) <= 0) return false;

    for (const idx of activeIndices) {
        if (idx === prevIdx || idx === currIdx || idx === nextIdx) continue;
        if (pointInTriangle(vertices[idx], a, b, c)) return false;
    }
    return true;
}

function bridgeHoles(outer: Position2D[], holes: Position2D[][]): Position2D[] {
    let merged = [...outer];

    for (const hole of holes) {
        if (hole.length < 3) continue;

        let rightmostIdx = 0;
        for (let i = 1; i < hole.length; i++) {
            if (hole[i].x > hole[rightmostIdx].x ||
                (hole[i].x === hole[rightmostIdx].x && hole[i].y > hole[rightmostIdx].y)) {
                rightmostIdx = i;
            }
        }
        const h = hole[rightmostIdx];

        let bestOuterIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < merged.length; i++) {
            if (!segmentVisible(h, merged[i], merged, [hole])) continue;
            const d = distance(h, merged[i]);
            if (d < bestDist) {
                bestDist = d;
                bestOuterIdx = i;
            }
        }

        if (bestOuterIdx < 0) continue;

        const merged2: Position2D[] = [];
        for (let i = 0; i <= bestOuterIdx; i++) {
            merged2.push(merged[i]);
        }
        for (let i = 0; i < hole.length; i++) {
            const idx = (rightmostIdx + i) % hole.length;
            merged2.push(hole[idx]);
        }
        merged2.push(hole[rightmostIdx]);
        for (let i = bestOuterIdx; i < merged.length; i++) {
            merged2.push(merged[i]);
        }
        merged = merged2;
    }

    return merged;
}

export class Overlay {
    boundary: Position2D[];
    cutouts: Position2D[][];
    color: string;

    constructor(boundary: Position2D[], color: string = "rgba(0, 0, 0, 0.3)") {
        this.boundary = boundary;
        this.cutouts = [];
        this.color = color;
    }

    addCutout(polygon: Position2D[]): void {
        this.cutouts.push(polygon);
    }

    addRectCutout(x: number, y: number, width: number, height: number): void {
        this.cutouts.push([
            { x, y },
            { x: x + width, y },
            { x: x + width, y: y + height },
            { x, y: y + height },
        ]);
    }

    addCircleCutout(cx: number, cy: number, radius: number, segments: number = 24): void {
        const points: Position2D[] = [];
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius,
            });
        }
        this.cutouts.push(points);
    }

    draw(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
        ctx.save();
        ctx.beginPath();

        const outer = this.boundary;
        if (outer.length < 3) {
            ctx.restore();
            return;
        }

        const outerCW = isClockwise(outer);
        ctx.moveTo(outer[0].x - offsetX, outer[0].y - offsetY);
        for (let i = 1; i < outer.length; i++) {
            if (outerCW) {
                ctx.lineTo(outer[i].x - offsetX, outer[i].y - offsetY);
            } else {
                ctx.lineTo(outer[outer.length - i].x - offsetX, outer[outer.length - i].y - offsetY);
            }
        }
        ctx.closePath();

        for (const cutout of this.cutouts) {
            if (cutout.length < 3) continue;
            const cutoutCW = isClockwise(cutout);
            ctx.moveTo(cutout[0].x - offsetX, cutout[0].y - offsetY);
            for (let i = 1; i < cutout.length; i++) {
                if (!cutoutCW) {
                    ctx.lineTo(cutout[i].x - offsetX, cutout[i].y - offsetY);
                } else {
                    ctx.lineTo(cutout[cutout.length - i].x - offsetX, cutout[cutout.length - i].y - offsetY);
                }
            }
            ctx.closePath();
        }

        ctx.fillStyle = this.color;
        ctx.fill("evenodd");
        ctx.restore();
    }

    triangulate(): Position2D[][] {
        const allPolygons: Position2D[][] = [this.boundary, ...this.cutouts];

        const hull: Position2D[] = [];
        for (let i = 0; i < this.boundary.length; i++) {
            hull.push({ x: this.boundary[i].x, y: this.boundary[i].y });
        }

        const orientedHoles: Position2D[][] = [];
        for (const cutout of this.cutouts) {
            const hole: Position2D[] = [];
            if (isClockwise(cutout)) {
                for (let i = 0; i < cutout.length; i++) {
                    hole.push({ x: cutout[i].x, y: cutout[i].y });
                }
            } else {
                for (let i = cutout.length - 1; i >= 0; i--) {
                    hole.push({ x: cutout[i].x, y: cutout[i].y });
                }
            }
            orientedHoles.push(hole);
        }

        const merged = bridgeHoles(hull, orientedHoles);
        if (merged.length < 3) return [];

        const triangles: Position2D[][] = [];
        const indices = merged.map((_, i) => i);

        while (indices.length > 3) {
            let earFound = false;
            for (let j = 0; j < indices.length; j++) {
                const prev = indices[(j - 1 + indices.length) % indices.length];
                const curr = indices[j];
                const next = indices[(j + 1) % indices.length];

                if (isEar(merged, prev, curr, next, indices)) {
                    triangles.push([
                        { x: merged[prev].x, y: merged[prev].y },
                        { x: merged[curr].x, y: merged[curr].y },
                        { x: merged[next].x, y: merged[next].y },
                    ]);
                    indices.splice(j, 1);
                    earFound = true;
                    break;
                }
            }
            if (!earFound) break;
        }

        if (indices.length === 3) {
            triangles.push([
                { x: merged[indices[0]].x, y: merged[indices[0]].y },
                { x: merged[indices[1]].x, y: merged[indices[1]].y },
                { x: merged[indices[2]].x, y: merged[indices[2]].y },
            ]);
        }

        return triangles;
    }
}

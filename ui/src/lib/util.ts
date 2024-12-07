
export type vec2 = [number, number];
/**
 * A 2x2 matrix represented as a 1D array: [a, b, c, d]
 * [a, b]
 * [c, d]
 */
export type matrix2 = [number, number, number, number];
/** 
 * The four corners of the box: x1,y1,x2,y2,x3,y3,x4,y4 
 * [x1, y1] is the top left corner
 * [x2, y2] is the top right corner
 * [x3, y3] is the bottom right corner
 * [x4, y4] is the bottom left corner
 */
export type box2 = [number, number, number, number, number, number, number, number];

export function generate_rotation_matrix(radians : number) : matrix2 {
    const sin = Math.sin(radians);
    const cos = Math.cos(radians);
    return [cos, -sin, sin, cos];
}

export function scaleVector(v : vec2, scale : number) : vec2 {
    return [v[0] * scale, v[1] * scale];
}

export function dotProduct(v1 : vec2, v2 : vec2) : number {
    return v1[0] * v2[0] + v1[1] * v2[1];
}

export function multiplyMatrixVector(m : matrix2, v : vec2) : vec2 {
    return [
        m[0] * v[0] + m[1] * v[1],
        m[2] * v[0] + m[3] * v[1]
    ];
}

export function multiplyMatrices(m1 : matrix2, m2 : matrix2) : matrix2 {
    return [
        m1[0] * m2[0] + m1[1] * m2[2],
        m1[0] * m2[1] + m1[1] * m2[3],
        m1[2] * m2[0] + m1[3] * m2[2],
        m1[2] * m2[1] + m1[3] * m2[3] 
    ];
}

export function transpose_matrix(m : matrix2) : matrix2 {
    return [m[0], m[2], m[1], m[3]];
}

export function applyMatrixToBox(m : matrix2, b : box2) : box2 {
    return [
        b[0] * m[0] + b[1] * m[1],
        b[0] * m[2] + b[1] * m[3],
        b[2] * m[0] + b[3] * m[1],
        b[2] * m[2] + b[3] * m[3],
        b[4] * m[0] + b[5] * m[1],
        b[4] * m[2] + b[5] * m[3],
        b[6] * m[0] + b[7] * m[1],
        b[6] * m[2] + b[7] * m[3]
    ];
}

export interface Position2D {
    x : number;
    y : number;
}

export function midpoint(o1 : Position2D, o2 : Position2D) : Position2D {
    return {
        x : (o1.x + o2.x) / 2,
        y : (o1.y + o2.y) / 2
    }
}
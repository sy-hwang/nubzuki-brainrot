import * as THREE from 'three';
import { DenseMatrix, SparseMatrix, Triplet } from '../libs/numeric.js';

// Vertex types enum
export const VertexType = {
    Fixed: 0,
    Draggable: 1,
    Calculated: 2
};

// Build neighbor table from faces
export const buildNeighborTable = (faces) => {
    const neighborTable = new Map();
    for (let faceIdx = 0; faceIdx < faces.length / 3; faceIdx++) {
        const [vA, vB, vC] = faces.slice(3 * faceIdx, 3 * faceIdx + 3);
        if (!neighborTable.has(vA)) neighborTable.set(vA, new Set());
        if (!neighborTable.has(vB)) neighborTable.set(vB, new Set());
        if (!neighborTable.has(vC)) neighborTable.set(vC, new Set());
        neighborTable.get(vA).add(vB);
        neighborTable.get(vA).add(vC);
        neighborTable.get(vB).add(vA);
        neighborTable.get(vB).add(vC);
        neighborTable.get(vC).add(vA);
        neighborTable.get(vC).add(vB);
    }
    return neighborTable;
};

// Build opposite vertex table from faces
export const buildOppositeVtxIdOfEdge = (faces) => {
    const oppositeVtxIdOfEdge = new Map();
    for (let faceIdx = 0; faceIdx < faces.length / 3; faceIdx++) {
        const [vA, vB, vC] = faces.slice(3 * faceIdx, 3 * faceIdx + 3);
        oppositeVtxIdOfEdge.set(`${vA}-${vB}`, vC);
        oppositeVtxIdOfEdge.set(`${vB}-${vC}`, vA);
        oppositeVtxIdOfEdge.set(`${vC}-${vA}`, vB);
    }
    return oppositeVtxIdOfEdge;
};

// Build weight table
export const buildWij = (verticesPos, faces, neighborTable, oppositeVtxIdOfEdge) => {
    const wIJ = new Map();
    for (let vtxIdx = 0; vtxIdx < verticesPos.length / 3; vtxIdx++) {
        const neighborVtxIds = Array.from(neighborTable.get(vtxIdx));
        for (const neighborVtxId of neighborVtxIds) {
            const calcCot = (idxI, idxJ, idxOpposite) => {
                const vtxPosI = new THREE.Vector3(verticesPos[3 * idxI], verticesPos[3 * idxI + 1], verticesPos[3 * idxI + 2]);
                const vtxPosJ = new THREE.Vector3(verticesPos[3 * idxJ], verticesPos[3 * idxJ + 1], verticesPos[3 * idxJ + 2]);
                const vtxPosK = new THREE.Vector3(verticesPos[3 * idxOpposite], verticesPos[3 * idxOpposite + 1], verticesPos[3 * idxOpposite + 2]);
                const vecKI = new THREE.Vector3().subVectors(vtxPosK, vtxPosI).normalize();
                const vecKJ = new THREE.Vector3().subVectors(vtxPosK, vtxPosJ).normalize();
                const cosine = vecKI.dot(vecKJ);
                const sine = vecKI.clone().cross(vecKJ).length();
                let cotTheta = cosine / sine;
                cotTheta = Math.max(cotTheta, 0);
                return cotTheta;
            };

            let cotAlpha;
            const edgeKeyIJ = `${vtxIdx}-${neighborVtxId}`;
            const oppositeVtxIdOfEdgeIJ = oppositeVtxIdOfEdge.get(edgeKeyIJ);
            if (oppositeVtxIdOfEdgeIJ !== undefined) {
                cotAlpha = calcCot(vtxIdx, neighborVtxId, oppositeVtxIdOfEdgeIJ);
            }

            let cotBeta;
            const edgeKeyJI = `${neighborVtxId}-${vtxIdx}`;
            const oppositeVtxIdOfEdgeJI = oppositeVtxIdOfEdge.get(edgeKeyJI);
            if (oppositeVtxIdOfEdgeJI !== undefined) {
                cotBeta = calcCot(vtxIdx, neighborVtxId, oppositeVtxIdOfEdgeJI);
            }

            let w;
            if (cotAlpha === undefined) w = cotBeta;
            else if (cotBeta === undefined) w = cotAlpha;
            else w = 0.5 * (cotAlpha + cotBeta);
            wIJ.set(edgeKeyIJ, w);
            wIJ.set(edgeKeyJI, w);
        }
    }
    return wIJ;
};

// Build sparse coefficient matrix L
export const buildMatrixL = (wIJ, nrVertices, neighborTable) => {
    const matrixL = [];
    for (let i = 0; i < nrVertices; i++) {
        matrixL[i] = matrixL[i] || [];
        let L_ii = 0;
        for (const j of neighborTable.get(i)) {
            const w_ij = wIJ.get(`${i}-${j}`);
            const L_ij = -w_ij;
            matrixL[i].push([j, L_ij]);
            L_ii += w_ij;
        }
        matrixL[i].push([i, L_ii]);
    }
    return matrixL;
};

// Calculate rotation matrices
export const calcRotationMatrices = (verticesOriginalPos, verticesPos, neighborTable, wIJ) => {
    const p = verticesOriginalPos;
    const pPrime = verticesPos;
    const nrVertices = p.length / 3;
    const R = [];

    for (let i = 0; i < nrVertices; i++) {
        const Si = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (const j of neighborTable.get(i)) {
            const w_ij = wIJ.get(`${i}-${j}`);
            const p_i = new THREE.Vector3(p[3 * i], p[3 * i + 1], p[3 * i + 2]);
            const p_j = new THREE.Vector3(p[3 * j], p[3 * j + 1], p[3 * j + 2]);
            const pPrime_i = new THREE.Vector3(pPrime[3 * i], pPrime[3 * i + 1], pPrime[3 * i + 2]);
            const pPrime_j = new THREE.Vector3(pPrime[3 * j], pPrime[3 * j + 1], pPrime[3 * j + 2]);
            const eij = new THREE.Vector3().subVectors(p_j, p_i);
            const eijPrime = new THREE.Vector3().subVectors(pPrime_j, pPrime_i);
            const outer = [
                eij.x * eijPrime.x, eij.x * eijPrime.y, eij.x * eijPrime.z,
                eij.y * eijPrime.x, eij.y * eijPrime.y, eij.y * eijPrime.z,
                eij.z * eijPrime.x, eij.z * eijPrime.y, eij.z * eijPrime.z
            ];
            outer.forEach((value, index) => {
                Si[index] += w_ij * value;
            });
        }

        const SiMat = [Si.slice(0, 3), Si.slice(3, 6), Si.slice(6, 9)];
        const SiMax = Math.max(...Si);
        for (let i = 0; i < 3; i++) {
            SiMat[i][i] += SiMax * 1e-6;
        }
        const USV = numeric.svd(SiMat);
        const [U, V] = [USV.U, USV.V];
        const detU = numeric.det(U);
        const detV = numeric.det(V);
        if (detU * detV < 0) {
            U[0][2] *= -1;
            U[1][2] *= -1;
            U[2][2] *= -1;
        }
        const UT = numeric.transpose(U);
        let Ri = numeric.dot(V, UT);
        if (Number.isNaN(numeric.det(Ri))) {
            console.error('Ri is NaN');
            Ri = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        }
        R.push(Ri);
    }
    return R;
};

// Update vertex positions using ARAP algorithm
export const updateVtxPosARAP = (verticesType, verticesOriginalPos, verticesPos, neighborTable, wIJ, LMatrix, geometry) => {
    const verticesToCalc = verticesType.map((vtxType, vtxId) => 
        vtxType === VertexType.Calculated ? vtxId : -1
    ).filter(vtxId => vtxId !== -1);

    const newToOri = verticesToCalc;
    const oriToNew = new Array(verticesPos.length).fill(-1);
    newToOri.forEach((oriId, newId) => oriToNew[oriId] = newId);

    const R = calcRotationMatrices(verticesOriginalPos, verticesPos, neighborTable, wIJ);
    const b = DenseMatrix.zeros(verticesToCalc.length, 3);

    for (let newI = 0; newI < verticesToCalc.length; newI++) {
        const oriI = newToOri[newI];
        const Ri = R[oriI];
        const pi = new THREE.Vector3(...verticesOriginalPos.slice(oriI * 3, oriI * 3 + 3));
        const neighborVtxIds = Array.from(neighborTable.get(oriI));
        let [bix, biy, biz] = [0, 0, 0];

        for (const oriJ of neighborVtxIds) {
            const Rj = R[oriJ];
            const RiPlusRj = numeric.add(Ri, Rj);
            const RiPlusRjMat = new THREE.Matrix3();
            RiPlusRjMat.set(...RiPlusRj[0], ...RiPlusRj[1], ...RiPlusRj[2]);
            const pj = new THREE.Vector3(...verticesOriginalPos.slice(oriJ * 3, oriJ * 3 + 3));
            const w_ij = wIJ.get(`${oriI}-${oriJ}`);
            const bi = pi.clone().sub(pj).multiplyScalar(0.5 * w_ij).applyMatrix3(RiPlusRjMat);
            bix += bi.x;
            biy += bi.y;
            biz += bi.z;
        }

        b.set(bix, newI, 0);
        b.set(biy, newI, 1);
        b.set(biz, newI, 2);
    }

    const oriL = LMatrix;
    const pPrime = verticesPos;
    const triplet = new Triplet(verticesToCalc.length, verticesToCalc.length);

    for (let newI = 0; newI < verticesToCalc.length; newI++) {
        const oriI = newToOri[newI];
        for (const [oriJ, oriLij] of oriL[oriI]) {
            const newJ = oriToNew[oriJ];
            if (newJ !== -1) {
                triplet.addEntry(oriLij, newI, newJ);
            } else {
                b.set(b.get(newI, 0) - oriLij * pPrime[oriJ * 3 + 0], newI, 0);
                b.set(b.get(newI, 1) - oriLij * pPrime[oriJ * 3 + 1], newI, 1);
                b.set(b.get(newI, 2) - oriLij * pPrime[oriJ * 3 + 2], newI, 2);
            }
        }
    }

    const L = SparseMatrix.fromTriplet(triplet);
    const A = L;
    const bx = b.subMatrix(0, verticesToCalc.length, 0, 1);
    const by = b.subMatrix(0, verticesToCalc.length, 1, 2);
    const bz = b.subMatrix(0, verticesToCalc.length, 2, 3);
    const llt = A.chol();
    const px = llt.solvePositiveDefinite(bx);
    const py = llt.solvePositiveDefinite(by);
    const pz = llt.solvePositiveDefinite(bz);

    for (let i = 0; i < verticesToCalc.length; i++) {
        const oriI = newToOri[i];
        verticesPos[oriI * 3 + 0] = px.get(i, 0);
        verticesPos[oriI * 3 + 1] = py.get(i, 0);
        verticesPos[oriI * 3 + 2] = pz.get(i, 0);
    }

    geometry.attributes.position.needsUpdate = true;
}; 
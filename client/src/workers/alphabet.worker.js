// Lightweight ONNX-only Worker for Alphabet Classification
// MediaPipe runs on main thread (needs DOM), this worker handles CPU-heavy ONNX inference only.

const origin = self.location.origin;
importScripts(origin + '/onnxruntime/ort.min.js');

const DIGITS = Array.from({ length: 10 }, (_, i) => String(i));
const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const ISL_ALPHABET = [...DIGITS, ...LETTERS];

let alphabetSession = null;
let alphabetMetadata = null;

// Configure ONNX to use local WASM
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = '/onnxruntime/';

function computeProbabilities(output) {
    const probs = Array.from(output);
    let bestIndex = 0;
    let bestProb = probs[0] ?? 0;
    for (let i = 1; i < probs.length; i++) {
        if (Number.isFinite(probs[i]) && probs[i] > bestProb) {
            bestProb = probs[i];
            bestIndex = i;
        }
    }
    return { bestIndex, bestProb };
}

function calcLandmarkListPx(normalizedLandmarks, imageWidth, imageHeight) {
    const landmarkPoint = [];
    for (let i = 0; i < normalizedLandmarks.length; i += 2) {
        if (i + 1 < normalizedLandmarks.length) {
            const x = Math.min(Math.floor(normalizedLandmarks[i] * imageWidth), imageWidth - 1);
            const y = Math.min(Math.floor(normalizedLandmarks[i + 1] * imageHeight), imageHeight - 1);
            landmarkPoint.push([x, y]);
        }
    }
    return landmarkPoint;
}

function preProcessLandmark(landmarkListPx) {
    const tempLandmarkList = landmarkListPx.map(pt => [...pt]);
    const baseX = tempLandmarkList[0][0];
    const baseY = tempLandmarkList[0][1];
    for (let i = 0; i < tempLandmarkList.length; i++) {
        tempLandmarkList[i][0] -= baseX;
        tempLandmarkList[i][1] -= baseY;
    }
    const flat = tempLandmarkList.flat();
    const maxValue = Math.max(...flat.map(Math.abs)) || 1.0;
    return flat.map(v => v / maxValue);
}

async function initModel(modelUrl) {
    try {
        console.log('👷 AlphabetWorker: Loading ONNX model...');
        alphabetSession = await ort.InferenceSession.create(modelUrl, {
            executionProviders: ['wasm']
        });
        alphabetMetadata = {
            inputName: alphabetSession.inputNames[0],
            outputName: alphabetSession.outputNames[0],
            labels: ISL_ALPHABET
        };
        console.log('✅ AlphabetWorker: ONNX Ready');
        self.postMessage({ type: 'INIT_DONE' });
    } catch (error) {
        console.error('❌ AlphabetWorker: Init Error:', error);
        self.postMessage({ type: 'ERROR', error: error.message });
    }
}

async function classifyLandmarks(handLandmarks, imageWidth, imageHeight, handSide) {
    if (!alphabetSession) return;

    try {
        const normalized = handLandmarks.flatMap(lm => [lm.x, lm.y]);
        const px = calcLandmarkListPx(normalized, imageWidth, imageHeight);
        const preProcessed = preProcessLandmark(px);

        const tensor = new ort.Tensor('float32', new Float32Array(preProcessed), [1, 42]);
        const output = await alphabetSession.run({ [alphabetMetadata.inputName]: tensor });
        const { bestIndex, bestProb } = computeProbabilities(output[alphabetMetadata.outputName].data);

        self.postMessage({
            type: 'ALPHABET_RESULT',
            result: {
                label: alphabetMetadata.labels[bestIndex],
                confidence: bestProb,
                index: bestIndex,
                handSide
            }
        });
    } catch (e) {
        // Silently ignore classification errors
    }
}

self.onmessage = async (event) => {
    const { type, data } = event.data;

    if (type === 'INIT') {
        await initModel(data.alphabetModelUrl);
    } else if (type === 'CLASSIFY') {
        await classifyLandmarks(data.landmarks, data.width, data.height, data.handSide);
    }
};

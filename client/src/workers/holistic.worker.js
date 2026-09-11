// Classic Web Worker
// Using local assets to guarantee correct MIME types and stable paths

console.log('👷 Worker: Initializing local scripts...');

// Use self.location.origin for robust absolute paths
const origin = self.location.origin;
importScripts(origin + '/mediapipe/holistic.js');
importScripts(origin + '/onnxruntime/ort.min.js');

const DIGITS = Array.from({ length: 10 }, (_, i) => String(i));
const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const ISL_ALPHABET = [...DIGITS, ...LETTERS];

let holistic = null;
let alphabetSession = null;
let alphabetMetadata = null;
let lastImageSize = { width: 640, height: 480 };

// Throttling state
let lastInferenceTime = 0;
const INFERENCE_THROTTLE_MS = 50; // ~20 FPS target for stability

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

async function initModels(modelUrls) {
    try {
        console.log('👷 Worker: Setting up Holistic...');
        // locateFile points to /mediapipe/ but Emscripten's SIMD code resolves
        // .wasm relative to the worker URL. Our Vite middleware plugin intercepts
        // ANY request for MediaPipe WASM/data files and serves them from public/mediapipe/.
        holistic = new Holistic({
            locateFile: (file) => `/mediapipe/${file}`
        });

        holistic.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
            refineFaceLandmarks: true
        });

        holistic.onResults(processResults);

        // Alphabet model
        if (modelUrls.alphabet) {
            console.log('👷 Worker: Loading Alphabet model...');
            alphabetSession = await ort.InferenceSession.create(modelUrls.alphabet, {
                executionProviders: ['wasm']
            });
            alphabetMetadata = {
                inputName: alphabetSession.inputNames[0],
                outputName: alphabetSession.outputNames[0],
                labels: ISL_ALPHABET
            };
        }

        console.log('✅ Worker: Infrastructure Ready (Local)');
        self.postMessage({ type: 'INIT_DONE' });
    } catch (error) {
        console.error('❌ Worker: Init Error:', error);
        self.postMessage({ type: 'ERROR', error: error.message });
    }
}

async function processResults(results) {
    const { width, height } = lastImageSize;
    let alphabetResult = null;

    if (alphabetSession && (results.leftHandLandmarks || results.rightHandLandmarks)) {
        try {
            const hand = results.rightHandLandmarks || results.leftHandLandmarks;
            const normalized = hand.flatMap(lm => [lm.x, lm.y]);
            const px = calcLandmarkListPx(normalized, width, height);
            const preProcessed = preProcessLandmark(px);

            const tensor = new ort.Tensor('float32', new Float32Array(preProcessed), [1, 42]);
            const output = await alphabetSession.run({ [alphabetMetadata.inputName]: tensor });
            const { bestIndex, bestProb } = computeProbabilities(output[alphabetMetadata.outputName].data);

            alphabetResult = {
                label: alphabetMetadata.labels[bestIndex],
                confidence: bestProb,
                index: bestIndex,
                handSide: results.rightHandLandmarks ? 'right' : 'left'
            };
        } catch (e) { }
    }

    self.postMessage({
        type: 'RESULTS',
        results: {
            landmarks: results,
            alphabet: alphabetResult
        }
    });
}

self.onmessage = async (event) => {
    const { type, data } = event.data;

    if (type === 'INIT') {
        await initModels(data);
    } else if (type === 'PROCESS_FRAME') {
        if (!holistic) return;

        const now = performance.now();
        if (now - lastInferenceTime < INFERENCE_THROTTLE_MS) {
            if (data.image.close) data.image.close();
            return;
        }
        lastInferenceTime = now;

        try {
            lastImageSize = { width: data.image.width, height: data.image.height };
            await holistic.send({ image: data.image });
        } catch (err) {
            console.warn('Worker: holistic.send error', err);
        } finally {
            if (data.image.close) data.image.close();
        }
    }
};

import { decode } from './lib.js';
const canvas = document.getElementById('index');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('upload-image');
const drawQOI = (qoi) => {
    canvas.width = qoi.width;
    canvas.height = qoi.height;
    const imageData = ctx.createImageData(qoi.width, qoi.height);
    imageData.data.set(qoi.pixels);
    ctx.putImageData(imageData, 0, 0);
};
fileInput.addEventListener('change', () => {
    const reader = new FileReader();
    const readerEventHandler = (event) => {
        if (typeof event.target.result === 'string') {
            throw new Error('Invalid QOI file');
        }
        const qoiFile = decode(new Uint8Array(event.target.result));
        drawQOI(qoiFile);
        reader.removeEventListener('load', readerEventHandler);
    };
    reader.addEventListener('load', readerEventHandler);
    reader.readAsArrayBuffer(fileInput.files[0]);
});

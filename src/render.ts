import { type } from 'os';
import {decode, QOIFile} from './lib';

const canvas = document.getElementById('index') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('upload-image') as HTMLInputElement;

const drawQOI = (qoi: QOIFile) => {
    canvas.width = qoi.width;
    canvas.height = qoi.height;

    const imageData = ctx.createImageData(qoi.width, qoi.height);
    imageData.data.set(qoi.pixels);

    ctx.putImageData(imageData, 0, 0);
};

fileInput.addEventListener('change', () => {
    const reader = new FileReader();

    const readerEventHandler = (event: ProgressEvent<FileReader>) => {
        if (typeof event.target.result === 'string') {
            throw new Error('Invalid QOI file')
        }

        const qoiFile = decode(new Uint8Array(event.target.result));
        drawQOI(qoiFile);
        reader.removeEventListener('load', readerEventHandler);
    }

    reader.addEventListener('load', readerEventHandler);
    reader.readAsArrayBuffer(fileInput.files[0]);
});
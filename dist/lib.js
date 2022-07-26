const colorsEqual = (c0, c1) => (c0.r === c1.r
    && c0.g === c1.g
    && c0.b === c1.b
    && c0.a === c1.a);
const colorDiff = (c0, c1) => ({
    r: c0.r - c1.r,
    g: c0.g - c1.g,
    b: c0.b - c1.b,
    a: c0.a - c1.a,
});
const QOI_HEADER_SIZE = 14;
const QOI_END_MARKER = [0, 0, 0, 0, 0, 0, 0, 1];
const QOI_END_MARKER_SIZE = QOI_END_MARKER.length;
const QOI_OP_RUN = 0xc0;
const QOI_OP_INDEX = 0x00;
const QOI_OP_DIFF = 0x40;
const QOI_OP_LUMA = 0x80;
const QOI_OP_RGB = 0xfe;
const QOI_OP_RGBA = 0xff;
const QOI_CHUNK_MASK = 0xc0;
const QOI_RUN_LENGTH = 0x3f;
const QOI_INDEX = 0x3f;
const QOI_DIFF_RED = 0x30;
const QOI_DIFF_GREEN = 0x0c;
const QOI_DIFF_BLUE = 0x03;
const QOI_LUMA_GREEN = 0x3f;
const QOI_LUMA_DRDG = 0xf0;
const QOI_LUMA_DBDG = 0x0f;
export const encode = (buffer, width, height, channels) => {
    const imageSize = buffer.byteLength;
    const lastPixel = imageSize - channels;
    let prevColor = { r: 0, g: 0, b: 0, a: 255 };
    let run = 0;
    const seenPixels = Array.from({ length: 64 }, () => ({ r: 0, g: 0, b: 0, a: 0 }));
    const maxSize = width * height * (channels + 1) + QOI_HEADER_SIZE + QOI_END_MARKER_SIZE;
    const bytes = new Uint8Array(maxSize);
    let index = 0;
    const write32 = (value) => {
        bytes[index++] = (value & 0xff000000) >> 24;
        bytes[index++] = (value & 0x00ff0000) >> 16;
        bytes[index++] = (value & 0x0000ff00) >> 8;
        bytes[index++] = (value & 0x000000ff) >> 0;
    };
    // Write the header
    write32(0x716f6966);
    write32(width);
    write32(height);
    bytes[index++] = channels;
    bytes[index++] = 1;
    for (let offset = 0; offset <= lastPixel; offset += channels) {
        const color = {
            r: buffer[offset + 0],
            g: buffer[offset + 1],
            b: buffer[offset + 2],
            a: (channels === 4) ? buffer[offset + 3] : prevColor.a
        };
        if (colorsEqual(color, prevColor)) {
            run++;
            if (run === 62 || offset === lastPixel) {
                bytes[index++] = QOI_OP_RUN | (run - 1);
                run = 0;
            }
        }
        else {
            if (run > 0) {
                bytes[index++] = QOI_OP_RUN | (run - 1);
                run = 0;
            }
            const hash = (color.r * 3 + color.g * 5 + color.b * 7 + color.a * 11) % 64;
            if (colorsEqual(color, seenPixels[hash])) {
                bytes[index++] = QOI_OP_INDEX | (hash);
            }
            else {
                seenPixels[hash] = { ...color };
                const diff = colorDiff(color, prevColor);
                const dr_dg = diff.r - diff.g;
                const db_dg = diff.b - diff.g;
                if (diff.a === 0) {
                    if ((diff.r >= -2 && diff.r <= 1) && (diff.g >= -2 && diff.g <= 1) && (diff.b >= -2 && diff.b <= 1)) {
                        bytes[index++] = (QOI_OP_DIFF
                            | ((diff.r + 2) << 4)
                            | ((diff.g + 2) << 2)
                            | ((diff.b + 2) << 0));
                    }
                    else if ((diff.g >= -32 && diff.g <= 31) && (dr_dg >= -8 && dr_dg <= 7) && (db_dg >= -8 && db_dg <= 7)) {
                        bytes[index++] = QOI_OP_LUMA | (diff.g + 32);
                        bytes[index++] = ((dr_dg + 8) << 4) | (db_dg + 8);
                    }
                    else {
                        bytes[index++] = QOI_OP_RGB;
                        bytes[index++] = color.r;
                        bytes[index++] = color.g;
                        bytes[index++] = color.b;
                    }
                }
                else {
                    bytes[index++] = QOI_OP_RGBA;
                    bytes[index++] = color.r;
                    bytes[index++] = color.g;
                    bytes[index++] = color.b;
                    bytes[index++] = color.a;
                }
            }
        }
        prevColor = { ...color };
    }
    QOI_END_MARKER.forEach(b => {
        bytes[index++] = b;
    });
    return bytes.slice(0, index);
};
export const decode = (buffer) => {
    let prevColor = { r: 0, g: 0, b: 0, a: 255 };
    const seenPixels = Array.from({ length: 64 }, () => ({ r: 0, g: 0, b: 0, a: 0 }));
    let readIndex = 0;
    let writeIndex = 0;
    const read32 = () => ((buffer[readIndex++] << 24)
        | (buffer[readIndex++] << 16)
        | (buffer[readIndex++] << 8)
        | (buffer[readIndex++] << 0));
    const readByte = () => buffer[readIndex++];
    if (buffer.byteLength < QOI_HEADER_SIZE + QOI_END_MARKER_SIZE) {
        throw new Error('Invalid QOI file');
    }
    if (read32() !== 0x716f6966) {
        throw new Error('Invalid QOI file.');
    }
    const width = read32();
    const height = read32();
    const channels = readByte();
    const colorSpace = readByte();
    const pixelBufferSize = width * height * channels;
    const pixelBuffer = new Uint8Array(pixelBufferSize);
    const writeColor = (c) => {
        pixelBuffer[writeIndex++] = c.r;
        pixelBuffer[writeIndex++] = c.g;
        pixelBuffer[writeIndex++] = c.b;
        pixelBuffer[writeIndex++] = c.a;
    };
    const insertColorIntoSeen = (c) => {
        const hash = (c.r * 3 + c.g * 5 + c.b * 7 + c.a * 11) % 64;
        seenPixels[hash] = { ...c };
    };
    while (readIndex < buffer.byteLength - QOI_END_MARKER_SIZE) {
        const byte = readByte();
        if (byte === QOI_OP_RGB) {
            prevColor.r = readByte();
            prevColor.g = readByte();
            prevColor.b = readByte();
            writeColor(prevColor);
            insertColorIntoSeen(prevColor);
            continue;
        }
        if (byte === QOI_OP_RGBA) {
            prevColor.r = readByte();
            prevColor.g = readByte();
            prevColor.b = readByte();
            prevColor.a = readByte();
            writeColor(prevColor);
            insertColorIntoSeen(prevColor);
            continue;
        }
        if ((byte & QOI_CHUNK_MASK) === QOI_OP_RUN) {
            const runLength = (byte & QOI_RUN_LENGTH) + 1;
            for (let i = 0; i < runLength; i++) {
                writeColor(prevColor);
            }
            continue;
        }
        if ((byte & QOI_CHUNK_MASK) === QOI_OP_INDEX) {
            const index = byte & QOI_INDEX;
            const color = seenPixels[index];
            writeColor(color);
            prevColor.r = color.r;
            prevColor.g = color.g;
            prevColor.b = color.b;
            prevColor.a = color.a;
            continue;
        }
        if ((byte & QOI_CHUNK_MASK) === QOI_OP_DIFF) {
            const dr = ((byte & QOI_DIFF_RED) >> 4) + 2;
            const dg = ((byte & QOI_DIFF_GREEN) >> 2) + 2;
            const db = ((byte & QOI_DIFF_BLUE) >> 0) + 2;
            prevColor.r = (prevColor.r + dr) & 0xff;
            prevColor.g = (prevColor.g + dg) & 0xff;
            prevColor.b = (prevColor.b + db) & 0xff;
            writeColor(prevColor);
            insertColorIntoSeen(prevColor);
            continue;
        }
        if ((byte & QOI_CHUNK_MASK) === QOI_OP_LUMA) {
            const dg = (byte & QOI_LUMA_GREEN) + 32;
            const byte2 = readByte();
            const drdg = ((byte2 & QOI_LUMA_DRDG) >> 4) + 8;
            const dbdg = ((byte2 & QOI_LUMA_DBDG) >> 0) + 8;
            const dr = drdg + dg;
            const db = dbdg + dg;
            prevColor.r = (prevColor.r + dr) & 0xff;
            prevColor.g = (prevColor.g + dg) & 0xff;
            prevColor.b = (prevColor.b + db) & 0xff;
            writeColor(prevColor);
            insertColorIntoSeen(prevColor);
            continue;
        }
    }
    return {
        width: 1,
        height: 1,
        channels: 4,
        colorSpace: 1,
        pixels: pixelBuffer
    };
};

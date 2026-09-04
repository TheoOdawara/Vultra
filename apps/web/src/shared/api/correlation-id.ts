const HEX = "0123456789abcdef";

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function uuidV7(now: number = Date.now()): string {
  const bytes = randomBytes(16);
  const timestamp = BigInt(now);

  for (let index = 0; index < 6; index += 1) {
    const shift = BigInt(8 * (5 - index));
    bytes[index] = Number((timestamp >> shift) & 0xffn);
  }

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  let hex = "";
  for (const byte of bytes) {
    hex += HEX[(byte >> 4) & 0x0f];
    hex += HEX[byte & 0x0f];
  }

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

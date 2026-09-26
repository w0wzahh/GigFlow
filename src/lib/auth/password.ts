import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

/** Hash a password with scrypt. Format: scrypt:N:r:p$salt$hash (hex). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, { N, r: R, p: P }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
  return `scrypt:${N}:${R}:${P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [params, saltHex, hashHex] = stored.split("$");
  if (!params?.startsWith("scrypt:") || !saltHex || !hashHex) return false;
  const [n, r, p] = params.slice(7).split(":").map(Number);
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const hash = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, expected.length, { N: n, r, p }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

describe("password hashing", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("CorrectHorse9");
    expect(hash).toMatch(/^scrypt:/);
    expect(await verifyPassword("CorrectHorse9", hash)).toBe(true);
    expect(await verifyPassword("WrongPass1", hash)).toBe(false);
  });
  it("produces unique salts", async () => {
    const a = await hashPassword("SamePass1");
    const b = await hashPassword("SamePass1");
    expect(a).not.toBe(b);
  });
  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });
});

describe("secret encryption", () => {
  it("round-trips AES-256-GCM", () => {
    const enc = encryptSecret("super-secret-credential");
    expect(enc).not.toContain("super-secret");
    expect(decryptSecret(enc)).toBe("super-secret-credential");
  });
  it("produces different ciphertexts for the same input", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });
});

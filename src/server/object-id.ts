import { randomBytes } from 'node:crypto';

/** Compact 12-byte identifier retained for API compatibility with existing 24-hex IDs. */
export class ObjectId {
  private readonly value: string;

  constructor(value?: string) {
    const id = value ?? randomBytes(12).toString('hex');
    if (!ObjectId.isValid(id)) throw new TypeError('Invalid identifier.');
    this.value = id.toLowerCase();
  }

  static isValid(value: unknown): value is string {
    return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
  }

  toHexString(): string { return this.value; }
  equals(other: ObjectId): boolean { return other instanceof ObjectId && this.value === other.value; }
  toJSON(): string { return this.value; }
}

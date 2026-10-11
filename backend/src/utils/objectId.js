const { randomBytes } = require("crypto");

class ObjectId {
  constructor(value) {
    const id = value ? String(value) : randomBytes(12).toString("hex");
    if (!ObjectId.isValid(id)) {
      throw new TypeError(`Invalid ObjectId: "${id}"`);
    }
    this.value = id.toLowerCase();
  }

  static isValid(value) {
    return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
  }

  toHexString() {
    return this.value;
  }

  toString() {
    return this.value;
  }

  equals(other) {
    if (!other) return false;
    const str = other instanceof ObjectId ? other.value : String(other);
    return this.value === str.toLowerCase();
  }

  toJSON() {
    return this.value;
  }
}

module.exports = ObjectId;

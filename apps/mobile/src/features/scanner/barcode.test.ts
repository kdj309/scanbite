import { createReadConfirmer, parseBarcode } from "./barcode";

describe("parseBarcode", () => {
  it("takes 8–14 digits, ignoring spaces people type", () => {
    expect(parseBarcode("8901 2345 6789 0")).toBe("8901234567890");
    expect(parseBarcode("12345678")).toBe("12345678");
  });

  it("refuses anything else", () => {
    expect(parseBarcode("1234567")).toBeNull();
    expect(parseBarcode("890123456789A")).toBeNull();
  });
});

describe("createReadConfirmer", () => {
  it("trusts a code once it's read twice in a row, not a one-off misread", () => {
    const confirm = createReadConfirmer();
    expect(confirm("8908026964011")).toBe(false);
    expect(confirm("908406964011")).toBe(false);
    expect(confirm("8908026964011")).toBe(false);
    expect(confirm("8908026964011")).toBe(true);
  });
});

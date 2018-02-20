var payloadForm = require("../payloadformats");

describe("decode", function () {
    it("should decode the bytes correctly", function () {
        var payload = [
            0b00000001, // 1
            0b00001100, // 12
            0b00000001, // 256
            0b00000001, // 1
        ];
        var result = payloadForm.decode(payload, 0);
        expect(result.type).toBe(1);
        expect(result.power).toBe(12);
        expect(result.reading).toBe(257);
    });
});  

describe("convert", function () {
    it("should convert a 0 type into a Still Here display_type", function () {
        var payload = {
            'type': 0
        };
        var result = payloadForm.convert(payload, 0);
        expect(result.display_type).toBe('Still Here');
    });

    it("should convert a 1 type into a Reading display_type", function () {
        var payload = {
            'type': 1
        };
        var result = payloadForm.convert(payload, 0);
        expect(result.display_type).toBe('Reading');
    });
});    

describe("validate", function () {
    it("should pass", function () {
        var payload = {
            'type': 1,
            'reading': 400,
            'power': 30,
        };
        var result = payloadForm.validate(payload, 0);
        expect(result).toBe(true);
    });

    it("should fail due to invalid reading", function () {
        var payload = {
            'type': 1,
            'reading': -20,
            'power': 500,
        };
        var result = payloadForm.validate(payload, 0);
        expect(result).toBe(false);
    });

    it("should fail due to no reading", function () {
        var payload = {
            'type': 1,
            'power': 30,
        };
        var result = payloadForm.validate(payload, 0);
        expect(result).toBe(false);
    });

    it("should fail due invalid power", function () {
        var payload = {
            'type': 0,
            'power': 500,
        };
        var result = payloadForm.validate(payload, 0);
        expect(result).toBe(false);
    });
});    
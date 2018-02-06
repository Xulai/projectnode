/**
 * Take bytes and turn it into fields
 * @param {[type]} bytes [description]
 * @param {[type]} port  [description]
 */
function Decoder(bytes, port) {
    // Decode an uplink message from a buffer
    // (array) of bytes to an object of fields.
    var decoded = {
        "type": bytes[0],
        "power": bytes[1]
    };

    if(bytes[2] !== undefined) {
        decoded.reading = (bytes[2] << 8)
                        + bytes[3];
    }

    return decoded;
}

/**
 * Making raw data readable
 * @param {[type]} decoded [description]
 * @param {[type]} port    [description]
 */
function Converter(decoded, port) {
    // Merge, split or otherwise
    // mutate decoded fields.
    var converted = decoded;

    switch(decoded.type) {
        case 1:
            converted.display_type = "Reading";
            break;
        case 2:
            converted.display_type = "Error";
            break;
        case 3:
            converted.display_type = "Microcontroller Error";
            break;
        case 4:
            converted.display_type = "Sensor Error";
            break;
        case 5:
            converted.display_type = "Battery Error";
            break;
        case 6:
            converted.display_type = "Storage Error";
            break;
        default:
            converted.display_type = "Still Here";
    }

    return converted;
}

/**
 * If data doesn't meet these requirements, nothing gets passed
 * @param {[type]} converted [description]
 * @param {[type]} port      [description]
 */
function Validator(converted, port) {
    
    // Fail if invalid type
    if(converted.type > 6 || converted.type < 0) {
        return false;
    }
    //Fail if power level is less than 1 (how can it send without power?) or above 100%
    if(converted.power > 100 || converted.power < 1) {
        return false;
    }
    // Fail if no reading when the type is for a reading
    if(converted.reading === undefined && converted.type == 1) {
        return false;
    }
    // Fail if reading is above/below max/min value.
    if(converted.reading !== undefined && (converted.reading < 0 || converted.reading > 5000)) {
        return false;
    } 

    return true;
}
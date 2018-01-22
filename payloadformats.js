function Decoder(bytes, port) {
    // Decode an uplink message from a buffer
    // (array) of bytes to an object of fields.
    var decoded = {
      "type": bytes[0],
      "power": bytes[1]
    };
    
    decoded.reading = (bytes[2] << 8)
                   + bytes[3]
  
    return decoded;
  }

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

  function Validator(converted, port) {
    
      if(converted.type > 6 || converted.type < 0) {
        return false;
      }
      if(converted.power > 100 || converted.power < 1) {
        return false;
      }
      if(converted.reading < -500 || converted.reading > 500) {
        return false;
      } 
    
      return true;
    }
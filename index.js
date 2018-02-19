// Require dotenv library to use .env variables
require('dotenv').config();
// Require influx, redis and the things network(tnn) libraries
var Influx = require('influx');
var Redis = require("redis");
var ttn = require("ttn");
// Connect to redis
redis = Redis.createClient();

// Load connection params from .env to connect to ttn
var appID = process.env.APP_ID;
var accessKey = process.env.ACCESS_KEY;

//Whitelist
var whitelist = [
    '0004a30b0019bc1a'
];

console.log('Connecting to Influx');

// Setup connection params and the schema for InfluxDB 
const influx = new Influx.InfluxDB({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    schema: [
        {
            measurement: 'readings',
            fields: {
                reading: Influx.FieldType.INTEGER,
                prev_difference_val: Influx.FieldType.INTEGER,
                prev_difference_pct: Influx.FieldType.INTEGER,
                power: Influx.FieldType.INTEGER
            },
            tags: [
                'device', 'type', 'display_type'
            ]
        },
        {
            measurement: 'still_heres',
            fields: {
                power: Influx.FieldType.INTEGER
            },
            tags: [
                'device', 'type', 'display_type'
            ]
        },
        {
            measurement: 'errors',
            fields: {
                power: Influx.FieldType.INTEGER
            },
            tags: [
                'device', 'type', 'display_type'
            ]
        }
    ]
})

redis.on("error", function (err) {
    console.log("Error " + err);
});

// Connect to InfluxDB, if database doesn't exist then create it using the schema above.
influx.getDatabaseNames()
    .then(names => {
        if (!names.includes(process.env.DB_NAME)) {
            console.log(`Creating database`);
            return influx.createDatabase(process.env.DB_NAME);
        }
    })
    .then(() => {
        console.log(`Database connected`);
        setupTtnApp();
    })
    .catch(err => {
        console.error(`Error creating Influx database!`);
    })

 /**
  * Connect to The Things Network to access the application api.
  */
function setupTtnApp() {
    console.log("Connecting to TTN Application API");

    ttn.application(appID, accessKey)
        .then((client) => {
            console.log("Connected to TTN Application API");
            console.log("Getting device list");
            client.devices()
                .then((devices) => {
                    if(devices != undefined && devices != null && devices != []) {
                        whitelist = devices.map(d => d['devEui']);
                    }
                    console.log("Updated Whitelist from device list");
                    setupTtnData();
                })
                .catch((error) => {
                    console.error("Unable to get device list", error);
                    setupTtnData();
                });
        })
        .catch((error) => {
            console.error("Unable to connect to TTN Application API", error);
            process.exit(1);
        });

}
    

 /**
  * Connect to The Things Network to receive data uplinks from.
  */
function setupTtnData() {
    console.log("Connecting to TTN Data API");

    ttn.data(appID, accessKey)
        .then((client) => {
            console.log("Connected to TTN Data API");
            console.log("Awaiting Uplinks");
            client.on("uplink", uplink)
        })
        .catch((error) => {
            console.error("Unable to connect to TTN Data API", error);
            process.exit(1);
        });
}

/**
 * Handle the data uplink received from The Things Network
 * 
 * @param {String} devId 
 * @param {Object} payload 
 */
function uplink(devId, payload) {
    console.log("Received uplink from ", devId);

    if(whitelist.indexOf(devId) === -1) {
        return;
    }

    switch (payload.payload_fields.display_type) {
        case "Reading":
            saveData(payload);
            break;
        case "Error":
        case "Microcontroller Error":
        case "Sensor Error":
        case "Battery Error":
        case "Storage Error":
            error(payload);
            break;
        default:
            stillHere(payload);
            break;
    }
} 


/**
 * Save a reading into influxdb.
 * 
 * @param {Object} payload 
 */
function saveData(payload) {

    redis.get("lastReading-"+payload.dev_id, function(err, reply) {
        if (reply) {
            var prevDifferenceVal = reply - payload.payload_fields.reading;
            var prevDifferencePct = prevDifferenceVal; 
            influx.writePoints([
                {
                    measurement: 'readings',
                    tags: { 
                        device: payload.dev_id,
                        type: payload.payload_fields.type,
                        display_type: payload.payload_fields.display_type
                    },
                    fields: { 
                        reading: payload.payload_fields.reading,
                        prev_difference_val: prevDifferenceVal,
                        prev_difference_pct: prevDifferencePct,
                        power: payload.payload_fields.power
                    },
                }
            ]).then(() => {
                console.log("Saved data to influx");
            });
        } else {
            influx.query('select LAST("reading") from readings').then(function(results) {
                if(results.length > 0) {
                    var prevDifferenceVal = results[0].last - payload.payload_fields.reading;
                    var prevDifferencePct = prevDifferenceVal; 
                    //Save to influx
                    influx.writePoints([
                        {
                            measurement: 'readings',
                            tags: { 
                                device: payload.dev_id,
                                type: payload.payload_fields.type,
                                display_type: payload.payload_fields.display_type
                            },
                            fields: { 
                                reading: payload.payload_fields.reading,
                                prev_difference_val: prevDifferenceVal,
                                prev_difference_pct: prevDifferencePct,
                                power: payload.payload_fields.power
                            },
                        }
                    ]).then(() => {
                        console.log("Saved data to influx");
                    });
                } else {
                    //Save to influx
                    influx.writePoints([
                        {
                            measurement: 'readings',
                            tags: { 
                                device: payload.dev_id,
                                type: payload.payload_fields.type,
                                display_type: payload.payload_fields.display_type
                            },
                            fields: { 
                                reading: payload.payload_fields.reading,
                                prev_difference_val: 0,
                                prev_difference_pct: 0,
                                power: payload.payload_fields.power
                            },
                        }
                    ]).then(() => {
                        console.log("Saved data to influx");
                    });
                }
                
            })
        }
    });

    redis.set('lastReading-'+payload.dev_id, payload.payload_fields.reading);
}

/**
 * Save an error payload into influxdb
 * 
 * @param {Object} payload 
 */
function errorPayload(payload) {
    //Save to influx
    influx.writePoints([
        {
            measurement: 'errors',
            tags: { 
                device: payload.dev_id,
                type: payload.payload_fields.type,
                display_type: payload.payload_fields.display_type
            },
            fields: { 
                power: payload.payload_fields.power
            },
        }
    ]).then(() => {
        console.log("Saved data to influx");
    });
}

/**
 * On still here save last reading gotten again.
 * 
 * @param {Object} payload 
 */
function stillHere(payload) {
    influx.writePoints([
        {
            measurement: 'still_heres',
            tags: { 
                device: payload.dev_id,
                type: payload.payload_fields.type,
                display_type: payload.payload_fields.display_type
            },
            fields: {
                power: payload.payload_fields.power
            },
        }
    ]).then(() => {
        console.log("Saved data to influx");
    });
}
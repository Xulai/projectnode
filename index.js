require('dotenv').config()
var ttn = require("ttn");
var Influx = require('influx');
var Redis = require("redis"),
redis = Redis.createClient();

// Load connection params for .env
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
        setupTTN();
    })
    .catch(err => {
        console.error(`Error creating Influx database!`);
    })

/**
 * Connect to The Things Network to receive data uplinks from.
 */
function setupTTN() {
    console.log("Connecting to TTN");
    
    ttn.data(appID, accessKey)
        .then((client) => {
            console.log("Connected to TTN");
            client.on("uplink", uplink)
        })
        .catch((error) => {
            console.error("Error", error);
            process.exit(1);
        });

    console.log("Connected to TTN");
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
    redis.set('lastReading-'+payload.dev_id, payload.payload_fields.reading);

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
                power: payload.payload_fields.power
            },
        }
    ]).then(() => {
        console.log("Saved data to influx");
    });
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
    //Save to influx
    redis.get("lastReading-"+payload.dev_id, function(err, reply) {
        if (reply) {
            influx.writePoints([
                {
                    measurement: 'readings',
                    tags: { 
                        device: payload.dev_id,
                        type: payload.payload_fields.type,
                        display_type: payload.payload_fields.display_type
                    },
                    fields: { 
                        reading: reply,
                        power: payload.payload_fields.power
                    },
                }
            ]).then(() => {
                console.log("Saved data to influx");
            });
        } else {
            console.log(err);
        }
    });
}
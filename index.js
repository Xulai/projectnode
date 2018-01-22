require('dotenv').config()
var ttn = require("ttn");
var Influx = require('influx');

var appID = process.env.APP_ID;
var accessKey = process.env.ACCESS_KEY;

console.log('Connecting to Influx');

const influx = new Influx.InfluxDB({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    schema: [
        {
            measurement: 'readings',
            fields: {
                reading: Influx.FieldType.INTEGER,
                power: Influx.FieldType.INTEGER,
                display_type: Influx.FieldType.STRING,
            },
            tags: [
                'device', 'type'
            ]
        }
    ]
})

influx.getDatabaseNames()
    .then(names => {
        if (!names.includes(process.env.DB_NAME)) {
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

function setupTTN() {
    console.log("Connecting to TTN");
    
    ttn.data(appID, accessKey)
        .then((client) => {
            client.on("uplink", saveData)
        })
        .catch((error) => {
            console.error("Error", error);
            process.exit(1);
        });

    console.log("Connected to TTN");
}


function saveData(devID, payload) {
    console.log("Received uplink from ", devID);
    //Save to influx
    influx.writePoints([
        {
            measurement: 'readings',
            tags: { 
                device: payload.dev_id,
                type: payload.payload_fields.type
            },
            fields: { 
                reading: payload.payload_fields.reading,
                power: payload.payload_fields.power,
                display_type: payload.payload_fields.display_type,
            },
        }
    ]).then(() => {
        console.log("Saved data to influx");
    });
}
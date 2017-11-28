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
            measurement: 'depth_readings',
            fields: {
                depth: Influx.FieldType.INTEGER,
            },
            tags: [
                'device'
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
}


function saveData(devID, payload) {
    console.log("Received uplink from ", devID);
    console.log(payload);

    //Save to influx
    // influx.writePoints([
    //     {
    //       measurement: 'response_times',
    //       tags: { host: os.hostname() },
    //       fields: { duration, path: req.path },
    //     }
    // ]).then(() => {
    //     console.log("Saved data to influx");
    // });
}
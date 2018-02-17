// Require dotenv library to use .env variables
require('dotenv').config()
// Require influx, moment, chance and the things network(tnn) libraries
var Influx = require('influx');
var ttn = require("ttn");
// Timestamp library
var moment = require('moment');
// Seeding library
var chance = require('chance').Chance();

// Load connection params for .env
var appID = process.env.APP_ID;
var accessKey = process.env.ACCESS_KEY;

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


// Connect to InfluxDB and create the database. If the database already exists, delete and remake it.
// Once DB is created seed data.
influx.getDatabaseNames()
    .then(names => {
        console.log(`Creating database`);
        if (names.includes(process.env.DB_NAME)) {
            return influx.dropDatabase(process.env.DB_NAME).then(() => {
                return influx.createDatabase(process.env.DB_NAME);
            });
        } 
        return influx.createDatabase(process.env.DB_NAME);
    })
    .then(() => {
        console.log(`Database connected`);
        console.log(`Seeding data`);
        return seedData();
    })
    .then(() => {
        console.log('Data Seeded');
    })
    .catch(err => {
        console.error(err);
    })

/**
 * For 6 fake device it will create readings to mock having them taken every 30 minutes for 3 years.
 * Then afterwards create a random amount of errors for each device.
 * @return {[type]} [description]
 */
function seedData() {
    var points = [];

    // Create readings and errors for 6 devices with the names from abc0 through abc5
    for(var deviceCount = 0; deviceCount < 6; deviceCount++) {
        var curTime = moment();
        var deviceName = 'abc' + deviceCount;
        var lastReading = chance.integer({min: -250, max: 250});
        var lastPower = chance.integer({min: 80, max: 100});
        
        // Get a reading fake taken at 30 min intervals for 3 years for each device
        for(var readingCount = 0; readingCount < 70080; readingCount++) {

            // The min, max modifiers to choose an int between
            var minModi = -10;
            var maxModi = 10;
            if(lastReading <= -500) {
                minModi = 0;
            }
            if(lastReading >= 500) {
                maxModi = 0;
            } 

            // Get the new reading, changing the value based on the modifiers above
            var newReading = lastReading + chance.integer({min: minModi, max: maxModi});

            // Have a chance to reset and charge the battery
            if(lastPower < 2 || (lastPower < 20 & chance.bool())) {
                var newPower = chance.integer({min: 80, max: 100}); 
            } else {
                // Else calculate the new power by taking away one or two points
                var newPower = lastPower + chance.integer({min: -5, max: 0});
                if(newPower < 1) {
                    newPower = 1;
                }
            }

            if(lastReading == newReading) {
                // Push the error point to create
                points.push({
                    measurement: 'still_heres',
                    tags: { 
                        device: deviceName,
                        type: 0,
                        display_type: getDisplayType(0)
                    },
                    fields: { 
                        power: newPower
                    }, 
                    // Random timestamp between the 3 years worth of readings
                    timestamp: '' + curTime.valueOf() + '000000',
                });
            } else {
                // Push a reading to create
                points.push({
                    measurement: 'readings',
                    tags: { 
                        device: deviceName,
                        type: lastReading == newReading ? 0 : 1,
                        display_type: getDisplayType(lastReading == newReading ? 0 : 1)
                    },
                    fields: { 
                        reading: newReading,
                        power: newPower
                    },
                    timestamp: '' + curTime.valueOf() + '000000',
                });
            }

            
            // Go back in time 30 minutes for the next reading
            curTime = curTime.subtract(30, 'minutes');
        }
        
        // Make a random amount (2-20) of errors for each device
        for(var errorCount = 0; errorCount < chance.integer({min: 2, max: 20}); errorCount++) {
            // Pick a random valid error type + a random power level
            var powerLevel = chance.integer({min: 1, max: 100});
            var errorType = chance.integer({min: 2, max: 6});

            // Push the error point to create
            points.push({
                measurement: 'errors',
                tags: { 
                    device: deviceName,
                    type: errorType,
                    display_type: getDisplayType(errorType)
                },
                fields: { 
                    power: powerLevel
                }, 
                // Random timestamp between the 3 years worth of readings
                timestamp: '' + moment().subtract(chance.integer({min: 2, max: 2102400}),'minutes').valueOf() + '000000',
            });
        }
    }

    // Seperate out the points into arrays of 5000 to not overload influx by writing them all at once
    points = chunkArray(points, 5000);

    // Insert all the points into influx
    for(var pointCount = 0; pointCount < points.length; pointCount++) {
        influx.writePoints(points[pointCount]);
    }

    return true;
}

/**
 * Returns the display type string for passed in int.
 * @returns {String} Display Type
 * @param {int} type 
 */
function getDisplayType(type) {
    switch(type) {
        case 1:
            return "Reading";
        case 2:
            return "Error";
        case 3:
            return "Microcontroller Error";
        case 4:
            return "Sensor Error";
        case 5:
            return "Battery Error";
        case 6:
            return "Storage Error";
        default:
            return "Still Here";
    }
}

/**
 * It splices out the passed in array into arrays with a length of the passed in chunk size.
 * @param {Array} arrayToChunk The array to make array chunks from
 * @param {number} chunkSize Size of the chunks to make
 */
function chunkArray(arrayToChunk, chunkSize){
    var results = [];
    
    while (arrayToChunk.length) {
        results.push(arrayToChunk.splice(0, chunkSize));
    }
    
    return results;
}

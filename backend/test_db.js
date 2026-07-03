const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority";

async function run() {
    const client = new MongoClient(uri);
    try {
        console.log("Connecting...");
        await client.connect();
        const db = client.db('mxv_shift_checklist');

        console.log("Fetching first document...");
        const doc = await db.collection('system_logs').findOne();
        console.log("Document:", doc);

        console.log("Done!");
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}

run();

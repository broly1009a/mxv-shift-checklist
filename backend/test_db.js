const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority";

async function run() {
    const client = new MongoClient(uri);
    try {
        console.log("Connecting...");
        await client.connect();
        const db = client.db('mxv_shift_checklist');

        console.log("Fetching recent RUN_LOT_MACRO bot jobs...");
        const jobs = await db.collection('bot_jobs').find({ jobType: 'RUN_LOT_MACRO' }).sort({ createdAt: -1 }).limit(5).toArray();
        for (const job of jobs) {
            console.log("------------------------");
            console.log("Job ID:", job._id);
            console.log("Status:", job.status);
            console.log("Payload:", JSON.stringify(job.payload));
            console.log("Logs count:", job.logs ? job.logs.length : 0);
            if (job.logs) {
                console.log("Last 5 Logs:");
                job.logs.slice(-5).forEach(l => console.log("  ", l));
            }
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}

run();

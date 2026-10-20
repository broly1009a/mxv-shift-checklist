import pymongo
import json
from bson import ObjectId

client = pymongo.MongoClient('mongodb://127.0.0.1:27017/')
db = client['mxv_shift_checklist']

# Search for job 6ad5f61e67544cdff20cac11
job = db['bot_jobs'].find_one({'_id': ObjectId('6ad5f61e67544cdff20cac11')})
if not job:
    print('Job not found by ObjectId, searching by string or regex...')
    job = db['bot_jobs'].find_one({'jobId': '6ad5f61e67544cdff20cac11'})

if job:
    print('FOUND JOB:')
    print('Job Type:', job.get('jobType'))
    print('Status:', job.get('status'))
    print('Payload:', json.dumps(job.get('payload', {}), default=str, indent=2))
    print('Logs:')
    for l in job.get('logs', []):
        print(' ', l)
else:
    print('Job still not found! Listing 5 most recent jobs:')
    for j in db['bot_jobs'].find().sort('_id', -1).limit(5):
        print(f"ID: {j['_id']}, Type: {j.get('jobType')}, Status: {j.get('status')}, Payload: {j.get('payload')}")

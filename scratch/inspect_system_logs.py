import os
from dotenv import dotenv_values
from pymongo import MongoClient

env = dotenv_values('backend/.env')
uri = env.get('MONGODB_URI') or env.get('MONGO_URI')
if not uri:
    print('No uri found')
    exit()

client = MongoClient(uri)
db = client.get_default_database()
count = db.system_logs.count_documents({})
print(f'Total system_logs: {count}')
logs = list(db.system_logs.find().sort('createdAt', -1).limit(10))
for l in logs:
    msg = l.get('message', '')
    print(f"[{l.get('createdAt')}] {l.get('eventType')}: {msg[:90]}")

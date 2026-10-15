import { MongoConnector } from "@mss/common";

export const mongoConnector = new MongoConnector(
  process.env.MONGO_URI,
  process.env.MONGO_USERNAME,
  process.env.MONGO_PASSWORD
);

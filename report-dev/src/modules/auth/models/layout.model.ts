import { Schema, Document, Types } from "mongoose";
import { mongoConnector } from "@/mongo/mongoConnector";

export interface ILayout {
  user: string;
  value: string;
  default: boolean;
}

export interface ILayoutDoc extends Document {
  user: Types.ObjectId;
  value: string;
  default: boolean;
}

const LayoutSchema = new Schema<ILayoutDoc>({
  user: {
    type: Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  value: {
    type: String,
    required: true,
  },
  default: {
    type: Boolean,
  },
});

const LayoutModel = mongoConnector.db.model<ILayoutDoc>(
  "layouts",
  LayoutSchema
);

export default LayoutModel;

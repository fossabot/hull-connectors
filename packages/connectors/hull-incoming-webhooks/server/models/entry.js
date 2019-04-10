// @flow
import mongoose from "mongoose";

// Need a global schema to avoid re-creating it several times in Tests;
let schema;

type ModelParams = {
  mongoUrl: string,
  collectionSize: string | number,
  collectionName: string
};
export default function({
  mongoUrl,
  collectionSize,
  collectionName
}: ModelParams) {
  mongoose.Promise = global.Promise;
  mongoose.connect(mongoUrl, { useNewUrlParser: true, useCreateIndex: true });
  schema =
    schema ||
    new mongoose.Schema(
      {
        connectorId: String,
        payload: Object,
        code: String,
        result: Object,
        date: Date
      },
      {
        capped: {
          size: collectionSize
        }
      }
    ).index({
      connectorId: 1,
      date: 1,
      _id: -1
    });
  return mongoose.model(collectionName, schema);
}

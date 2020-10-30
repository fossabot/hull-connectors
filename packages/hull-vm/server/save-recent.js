// @flow

import type { HullContext } from "hull";
import type { Entry, Payload, Result } from "../types";
import serialize from "./serialize";

export default function saveRecent(
  ctx: HullContext,
  {
    EntryModel,
    code,
    result,
    date,
    payload
  }: {
    result: Result,
    code: string,
    date?: string,
    payload: Payload,
    EntryModel: Object
  }
) {
  const { connector } = ctx;
  const entry: Entry = {
    connectorId: connector.id,
    result: serialize(result),
    code,
    payload,
    date: date || new Date().toString()
  };
  return EntryModel.create([entry], {
    checkKeys: false
  });
}

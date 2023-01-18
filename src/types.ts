import { Knex } from "knex";

export type JSONPrimitive_T = string | number | boolean | null;
export type JSONValue_T = JSONPrimitive_T | JSONObject_T | JSONArray_T;
export type JSONObject_T = { [member: string]: JSONValue_T };
export type JSONArray_T = Array<JSONValue_T>;

export type QueryParams_T = Knex.RawBinding[] | Knex.ValueDict;

export interface QueryResult_T<T> {
  rows: T[];
}

export type QueryFn = <T>(
  sql: string,
  params: QueryParams_T
) => Promise<QueryResult_T<T>>;

export interface DbTransactionCallbackParams_T {
  query: QueryFn;
}

export type DbTransactionCallback_T<T> = (
  params: DbTransactionCallbackParams_T
) => Promise<T>;

export interface Transactable {
  query?: QueryFn;
}

export interface ModelFetchOptions_T {
  query?: QueryFn;
}

export interface ModelOptions_T {
  idAttribute?: string;
  updateAttribute?: string;
  createAttribute?: string;
}

export interface ModelSaveOptions_T extends Transactable {
  returnNew?: boolean;
}

export interface ModelRecord_T {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Model_T {
  save: (
    record: ModelRecord_T,
    opts: ModelSaveOptions_T
  ) => Promise<JSONObject_T | void>;
}

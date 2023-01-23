import { HTTPError } from "@larner.dev/http-codes";
import { db, Db } from "./db";
import {
  JSONObject_T,
  JSONValue_T,
  ModelFetchOptions_T,
  ModelSaveOptions_T,
  Transactable,
} from "./types";

export interface ModelParams<T> {
  table: string;
  getIdField: ModelFieldGetter<T>;
  getCreatedField: ModelFieldGetter<T>;
  getUpdatedField: ModelFieldGetter<T>;
  getDeletedField: ModelFieldGetter<T>;
  parse?: (model: JSONObject_T) => T;
  db?: Db;
}

type ModelField<T> = Extract<keyof T, string>;
type ModelFieldGetter<T> = () => ModelField<T> | null;

export abstract class Model<T> {
  public readonly table: string;
  public readonly getIdField: ModelFieldGetter<T>;
  public readonly getCreatedField: ModelFieldGetter<T>;
  public readonly getUpdatedField: ModelFieldGetter<T>;
  public readonly getDeletedField: ModelFieldGetter<T>;
  public readonly parse?: (model: JSONObject_T) => T;
  public readonly db;
  constructor(params: ModelParams<T>) {
    this.table = params.table;
    this.getIdField = params.getIdField;
    this.getCreatedField = params.getCreatedField;
    this.getUpdatedField = params.getUpdatedField;
    this.getDeletedField = params.getDeletedField;
    this.parse = params.parse;
    this.db = params.db || db;
  }
  async save(
    record: Partial<T>,
    { returnNew, query }: ModelSaveOptions_T = {}
  ): Promise<T | null> {
    const dbQuery = query || this.db.query.bind(this.db);
    const idField = this.getIdField();
    const keys: ModelField<T>[] = Object.keys(record) as ModelField<T>[];
    const keysWithoutId = keys.filter((k) => k !== idField);

    if (!keysWithoutId.length) {
      throw new Error("Record has nothing to save.");
    }

    if (!idField) {
      throw new Error("Model has no id field.");
    }

    let id = record[idField];
    let recordExists = false;

    if (record[idField] !== undefined) {
      recordExists = !!(await this.fetch({ [idField]: id } as Partial<T>));
    }

    if (recordExists) {
      const updateField = this.getUpdatedField();
      if (updateField && !record[updateField]) {
        (record[updateField] as unknown as string) = new Date().toISOString();
        keysWithoutId.push(updateField);
      }

      const params: any[] = [this.table];
      for (const key of keysWithoutId) {
        params.push(key);
        params.push(record[key]);
      }
      params.push(idField);
      params.push(record[idField]);
      await dbQuery(
        `update ?? set ${keysWithoutId
          .map(() => "?? = ?")
          .join(", ")} where ?? = ?`,
        params
      );
    } else {
      const createdField = this.getCreatedField();
      if (createdField && !record[createdField]) {
        (record[createdField] as unknown as string) = new Date().toISOString();
        keys.push(createdField);
      }
      const values: any[] = keys.map((k) => {
        const val = record[k];
        if (["boolean", "number", "string"].includes(typeof val)) {
          return val;
        }
        return JSON.stringify(val);
      });
      const params: JSONValue_T[] = [this.table as JSONValue_T]
        .concat(keys)
        .concat(values)
        .concat(idField);
      const result = await dbQuery(
        `
					insert into ?? (${keys.map(() => "??").join(", ")})
					values (${keys.map(() => "?").join(", ")})
					returning ??
				`,
        params
      );
      id = (result.rows[0] as T)[idField];
    }
    if (returnNew) {
      return this.fetch({ [idField]: id } as unknown as T, { query });
    }
    return null;
  }
  async saveAndFetch(record: Partial<T>, opts: Transactable = {}): Promise<T> {
    const result = await this.save(record, {
      returnNew: true,
      query: opts.query,
    });
    if (!result) {
      throw new HTTPError.InternalServerError("FAILED_TO_SAVE");
    }
    return result;
  }
  async fetch(
    record: Partial<T>,
    opts: ModelFetchOptions_T = {}
  ): Promise<T | null> {
    const { query } = opts;
    const dbQuery = query || this.db.query.bind(this.db);
    const keys: ModelField<T>[] = Object.keys(record) as ModelField<T>[];
    if (!keys.length) {
      throw new Error("No filters supplied to fetch.");
    }
    let params: JSONValue_T[] = [this.table as JSONValue_T];
    for (const key of keys) {
      params.push(key);
      if (record[key] !== null) {
        if (Array.isArray(record[key])) {
          params = [...params, ...(record[key] as unknown as JSONValue_T[])];
        } else {
          params.push(record[key] as unknown as JSONValue_T);
        }
      }
    }
    const results = await dbQuery<T>(
      `
			select * from ?? where
			${keys
        .map((k) => {
          if (record[k] === null) {
            return "?? IS NULL";
          }
          if (Array.isArray(record[k])) {
            return `?? IN (${(record[k] as unknown as JSONValue_T[])
              .map(() => "?")
              .join(",")})`;
          }
          return "?? = ?";
        })
        .join(" and ")}
			limit 1
		`,
      params
    );

    let result: T | null = results.rows[0] || null;
    if (result && this.parse) {
      result = this.parse(result);
    }

    return result;
  }
  async fetchOrThrow(
    record: Partial<T>,
    opts: ModelFetchOptions_T = {}
  ): Promise<T> {
    const result = await this.fetch(record, opts);
    const idField = this.getIdField();
    if (!result) {
      const params = idField ? { [idField]: record[idField] } : null;
      throw new HTTPError.NotFound("RECORD_NOT_FOUND", params);
    }
    return result;
  }
  async hardDelete(record: Partial<T>, opts: Transactable = {}) {
    const found = await this.fetch(record, opts);
    const idField = this.getIdField();
    if (found && idField) {
      const { query } = opts;
      const dbQuery = query || this.db.query.bind(this.db);

      await dbQuery(`delete from ?? where ?? = ?`, [
        this.table,
        idField,
        found[idField] as JSONValue_T,
      ]);
    }
  }
}

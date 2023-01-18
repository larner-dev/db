import { Knex } from "knex";
import { DbTransactionCallback_T, QueryParams_T, QueryResult_T } from "./types";

class Db {
  public client: Knex | null;
  constructor() {
    this.client = null;
  }
  public async connect(client: Knex): Promise<void> {
    if (this.client) {
      this.client.destroy();
    }
    this.client = client;
  }
  public query<T>(
    sql: string,
    params?: QueryParams_T
  ): Promise<QueryResult_T<T>> {
    if (!this.client) {
      throw new Error("Cannot query database before connected");
    }
    return this.client.raw(sql, params || []);
  }
  private raw(
    fn: <T>(sql: string, params?: QueryParams_T) => Promise<QueryResult_T<T>>
  ) {
    return <T>(
      sql: string,
      params: QueryParams_T
    ): Promise<QueryResult_T<T>> => {
      if (!this.client) {
        throw new Error("Cannot query database before we have connected");
      }
      return fn(sql, params);
    };
  }
  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
  }
  public transaction<T>(callback: DbTransactionCallback_T<T>): Promise<T> {
    if (!this.client) {
      throw new Error("Cannot query database before we have connected");
    }
    return this.client.transaction((trx) => {
      return callback({ query: this.raw(trx.raw.bind(trx)) });
    });
  }
}

export type Db_T = Db;

export const db = new Db();

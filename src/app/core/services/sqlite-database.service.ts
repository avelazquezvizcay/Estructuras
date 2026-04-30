import { Injectable } from '@angular/core';

export interface SqliteResult {
  lastInsertRowid: number | string;
  changes: number;
}

declare global {
  interface Window {
    electronAPI: {
      dbAll: (sql: string, params?: any[]) => Promise<any[]>;
      dbGet: (sql: string, params?: any[]) => Promise<any>;
      dbRun: (sql: string, params?: any[]) => Promise<SqliteResult>;
      dbTransaction: (statements: { sql: string; params: any[] }[]) => Promise<{ success: boolean }>;
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class SqliteDatabaseService {
  constructor() {}

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return await window.electronAPI.dbAll(sql, params);
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return await window.electronAPI.dbGet(sql, params);
  }

  async run(sql: string, params: any[] = []): Promise<SqliteResult> {
    return await window.electronAPI.dbRun(sql, params);
  }

  async transaction(statements: { sql: string; params: any[] }[]): Promise<boolean> {
    const result = await window.electronAPI.dbTransaction(statements);
    return result.success;
  }
}

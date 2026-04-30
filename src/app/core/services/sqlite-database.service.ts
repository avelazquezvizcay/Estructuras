import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SqliteResult {
  lastInsertRowid: number | string;
  changes: number;
}

@Injectable({
  providedIn: 'root'
})
export class SqliteDatabaseService {
  private http = inject(HttpClient);
  // Usa window.location.hostname para que funcione desde el celular en la red local
  private apiUrl = environment.apiUrl || `http://${window.location.hostname}:3000/api`;

  constructor() {}

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return firstValueFrom(this.http.post<T[]>(`${this.apiUrl}/db/all`, { sql, params }));
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const res = await firstValueFrom(this.http.post<T>(`${this.apiUrl}/db/get`, { sql, params }));
    return res === null ? undefined : res;
  }

  async run(sql: string, params: any[] = []): Promise<SqliteResult> {
    return firstValueFrom(this.http.post<SqliteResult>(`${this.apiUrl}/db/run`, { sql, params }));
  }

  async transaction(statements: { sql: string; params: any[] }[]): Promise<boolean> {
    const res = await firstValueFrom(this.http.post<{success: boolean}>(`${this.apiUrl}/db/transaction`, { statements }));
    return res.success;
  }
}

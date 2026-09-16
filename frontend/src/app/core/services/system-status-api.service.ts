import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import type { SystemStatus } from '../models/system-status.model';

@Injectable({
  providedIn: 'root',
})
export class SystemStatusApiService {
  private readonly httpClient = inject(HttpClient);

  getSystemStatus(): Observable<SystemStatus> {
    return this.httpClient.get<SystemStatus>(`${API_BASE_URL}/status`);
  }
}

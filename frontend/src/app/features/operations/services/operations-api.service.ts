import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import type { DeadLetterReplayResponse, WorkerCommandResponse } from '../models/operation.model';

@Injectable({
  providedIn: 'root',
})
export class OperationsApiService {
  private readonly httpClient = inject(HttpClient);

  startBackfill(): Observable<WorkerCommandResponse> {
    return this.httpClient.post<WorkerCommandResponse>(
      `${API_BASE_URL}/workers/backfill/start`,
      {},
    );
  }

  stopBackfill(): Observable<WorkerCommandResponse> {
    return this.httpClient.post<WorkerCommandResponse>(`${API_BASE_URL}/workers/backfill/stop`, {});
  }

  startIncrementalSync(): Observable<WorkerCommandResponse> {
    return this.httpClient.post<WorkerCommandResponse>(
      `${API_BASE_URL}/workers/incremental-sync/start`,
      {},
    );
  }

  stopIncrementalSync(): Observable<WorkerCommandResponse> {
    return this.httpClient.post<WorkerCommandResponse>(
      `${API_BASE_URL}/workers/incremental-sync/stop`,
      {},
    );
  }

  replayDeadLetterQueue(limit: number): Observable<DeadLetterReplayResponse> {
    const params = new HttpParams().set('limit', limit);

    return this.httpClient.post<DeadLetterReplayResponse>(
      `${API_BASE_URL}/dead-letter-queue/replay`,
      {},
      {
        params,
      },
    );
  }
}

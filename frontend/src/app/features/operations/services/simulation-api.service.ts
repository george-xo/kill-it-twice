import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import type {
  PoisonChangeResult,
  SimulatedCustomerChange,
  SimulationDestination,
  SimulationState,
} from '../models/simulation.model';

@Injectable({
  providedIn: 'root',
})
export class SimulationApiService {
  private readonly httpClient = inject(HttpClient);

  getState(): Observable<SimulationState> {
    return this.httpClient.get<SimulationState>(`${API_BASE_URL}/simulations`);
  }

  failDestination(destination: SimulationDestination): Observable<SimulationState> {
    return this.httpClient.post<SimulationState>(
      `${API_BASE_URL}/simulations/destinations/${destination}/fail`,
      {},
    );
  }

  recoverDestination(destination: SimulationDestination): Observable<SimulationState> {
    return this.httpClient.post<SimulationState>(
      `${API_BASE_URL}/simulations/destinations/${destination}/recover`,
      {},
    );
  }

  recoverAllDestinations(): Observable<SimulationState> {
    return this.httpClient.post<SimulationState>(
      `${API_BASE_URL}/simulations/destinations/recover-all`,
      {},
    );
  }

  toggleCustomerStatus(customerId: string): Observable<SimulatedCustomerChange> {
    return this.httpClient.post<SimulatedCustomerChange>(
      `${API_BASE_URL}/simulations/customers/${customerId}/toggle-status`,
      {},
    );
  }

  createPoisonChange(): Observable<PoisonChangeResult> {
    return this.httpClient.post<PoisonChangeResult>(
      `${API_BASE_URL}/simulations/poison-change`,
      {},
    );
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import type {
  Customer,
  CustomerListResponse,
  CustomerSearchParams,
} from '../models/customer.model';

@Injectable({
  providedIn: 'root',
})
export class CustomersApiService {
  private readonly httpClient = inject(HttpClient);

  getCustomers(searchParams: CustomerSearchParams = {}): Observable<CustomerListResponse> {
    let httpParams = new HttpParams().set('limit', searchParams.limit ?? 25);

    if (searchParams.query) {
      httpParams = httpParams.set('query', searchParams.query);
    }

    if (searchParams.status) {
      httpParams = httpParams.set('status', searchParams.status);
    }

    if (searchParams.cursor) {
      httpParams = httpParams.set('cursor', searchParams.cursor);
    }

    return this.httpClient.get<CustomerListResponse>(`${API_BASE_URL}/customers`, {
      params: httpParams,
    });
  }

  getCustomer(customerId: string): Observable<Customer> {
    return this.httpClient.get<Customer>(`${API_BASE_URL}/customers/${customerId}`);
  }
}

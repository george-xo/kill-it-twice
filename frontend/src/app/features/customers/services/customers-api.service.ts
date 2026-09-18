import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import { DEFAULT_CUSTOMERS_PAGE_SIZE } from '../constants/customers.constants';
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

  getCustomers(searchParameters: CustomerSearchParams = {}): Observable<CustomerListResponse> {
    let httpParameters = new HttpParams().set(
      'limit',
      searchParameters.limit ?? DEFAULT_CUSTOMERS_PAGE_SIZE,
    );

    if (searchParameters.query) {
      httpParameters = httpParameters.set('query', searchParameters.query);
    }

    if (searchParameters.status) {
      httpParameters = httpParameters.set('status', searchParameters.status);
    }

    if (searchParameters.cursor) {
      httpParameters = httpParameters.set('cursor', searchParameters.cursor);
    }

    return this.httpClient.get<CustomerListResponse>(`${API_BASE_URL}/customers`, {
      params: httpParameters,
    });
  }

  getCustomer(customerId: string): Observable<Customer> {
    return this.httpClient.get<Customer>(`${API_BASE_URL}/customers/${customerId}`);
  }
}

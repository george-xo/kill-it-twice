import { AsyncPipe, DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';

import { CUSTOMER_ID_ROUTE_PARAMETER, CUSTOMERS_MESSAGES } from '../constants/customers.constants';
import { CustomersApiService } from '../services/customers-api.service';

@Component({
  selector: 'app-customer-details',
  imports: [
    AsyncPipe,
    DatePipe,
    JsonPipe,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './customer-details.component.html',
  styleUrl: './customer-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDetailsComponent {
  private readonly activatedRoute = inject(ActivatedRoute);

  private readonly customersApiService = inject(CustomersApiService);

  protected readonly errorMessage = signal<string | null>(null);

  protected readonly customer$ = this.activatedRoute.paramMap.pipe(
    map((parameters) => parameters.get(CUSTOMER_ID_ROUTE_PARAMETER)),
    switchMap((customerId) => {
      if (!customerId) {
        this.errorMessage.set(CUSTOMERS_MESSAGES.CUSTOMER_ID_MISSING);

        return of(null);
      }

      return this.customersApiService.getCustomer(customerId).pipe(
        catchError(() => {
          this.errorMessage.set(CUSTOMERS_MESSAGES.CUSTOMER_LOAD_FAILED);

          return of(null);
        }),
      );
    }),
  );
}

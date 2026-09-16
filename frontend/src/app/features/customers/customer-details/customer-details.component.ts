import { AsyncPipe, DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';

import { CustomersApiService } from '../services/customers-api.service';

@Component({
  selector: 'app-customer-details',
  imports: [
    AsyncPipe,
    DatePipe,
    JsonPipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
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
    map((params) => params.get('customerId')),
    switchMap((customerId) => {
      if (!customerId) {
        this.errorMessage.set('Customer ID is missing');
        return of(null);
      }

      return this.customersApiService.getCustomer(customerId).pipe(
        catchError(() => {
          this.errorMessage.set('Customer could not be loaded');
          return of(null);
        }),
      );
    }),
  );
}

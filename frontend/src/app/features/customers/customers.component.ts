import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import {
  CUSTOMER_STATUSES,
  CUSTOMER_TABLE_COLUMNS,
  CUSTOMERS_LABELS,
  CUSTOMERS_MESSAGES,
  DEFAULT_CUSTOMERS_PAGE_SIZE,
} from './constants/customers.constants';
import type { Customer, CustomerStatus } from './models/customer.model';
import { CustomersApiService } from './services/customers-api.service';

@Component({
  selector: 'app-customers',
  imports: [
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersComponent implements OnInit {
  private readonly customersApiService = inject(CustomersApiService);

  private readonly destroyRef = inject(DestroyRef);

  protected readonly customerStatuses = CUSTOMER_STATUSES;
  protected readonly customerLabels = CUSTOMERS_LABELS;

  protected readonly customers = signal<Customer[]>([]);
  protected readonly total = signal(0);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly displayedColumns = [...CUSTOMER_TABLE_COLUMNS];

  protected readonly searchForm = new FormGroup({
    query: new FormControl('', {
      nonNullable: true,
    }),
    status: new FormControl<CustomerStatus | ''>('', {
      nonNullable: true,
    }),
  });

  ngOnInit(): void {
    this.loadCustomers();
  }

  protected search(): void {
    this.loadCustomers();
  }

  protected resetSearch(): void {
    this.searchForm.reset({
      query: '',
      status: '',
    });

    this.loadCustomers();
  }

  protected loadMore(): void {
    const cursor = this.nextCursor();

    if (!cursor || this.loading()) {
      return;
    }

    this.loadCustomers(cursor);
  }

  private loadCustomers(cursor?: string): void {
    const { query, status } = this.searchForm.getRawValue();

    this.loading.set(true);
    this.errorMessage.set(null);

    this.customersApiService
      .getCustomers({
        query: query.trim() || undefined,
        status: status || undefined,
        cursor,
        limit: DEFAULT_CUSTOMERS_PAGE_SIZE,
      })
      .pipe(
        finalize(() => {
          this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          const customers = cursor ? [...this.customers(), ...response.items] : response.items;

          this.customers.set(customers);
          this.total.set(response.total);
          this.nextCursor.set(response.nextCursor);
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(error.message || CUSTOMERS_MESSAGES.LIST_LOAD_FAILED);
        },
      });
  }
}

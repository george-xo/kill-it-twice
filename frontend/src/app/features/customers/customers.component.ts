import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';

import type { Customer, CustomerStatus } from './models/customer.model';
import { CustomersApiService } from './services/customers-api.service';

@Component({
  selector: 'app-customers',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
    DatePipe,
  ],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersComponent {
  private readonly customersApiService = inject(CustomersApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly customers = signal<Customer[]>([]);
  protected readonly total = signal(0);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly displayedColumns = ['id', 'name', 'email', 'status', 'version', 'updatedAt'];

  protected readonly searchForm = new FormGroup({
    query: new FormControl('', {
      nonNullable: true,
    }),
    status: new FormControl<CustomerStatus | ''>('', {
      nonNullable: true,
    }),
  });

  constructor() {
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
        limit: 25,
      })
      .pipe(
        finalize(() => {
          this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.customers.set(cursor ? [...this.customers(), ...response.items] : response.items);

          this.total.set(response.total);
          this.nextCursor.set(response.nextCursor);
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(error.message || 'Customers could not be loaded');
        },
      });
  }
}

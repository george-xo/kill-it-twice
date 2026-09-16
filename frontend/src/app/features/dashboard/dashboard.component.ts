import { AsyncPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, type Observable, of } from 'rxjs';

import type { SystemStatus } from '../../core/models/system-status.model';
import { SystemStatusApiService } from '../../core/services/system-status-api.service';

@Component({
  selector: 'app-dashboard',
  imports: [AsyncPipe, MatButtonModule, MatCardModule, MatProgressSpinnerModule, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly systemStatusApiService = inject(SystemStatusApiService);

  protected readonly errorMessage = signal<string | null>(null);

  protected systemStatus$ = this.loadSystemStatus();

  protected reload(): void {
    this.errorMessage.set(null);
    this.systemStatus$ = this.loadSystemStatus();
  }

  private loadSystemStatus(): Observable<SystemStatus | null> {
    return this.systemStatusApiService.getSystemStatus().pipe(
      catchError((error: HttpErrorResponse) => {
        this.errorMessage.set(error.message || 'System status could not be loaded');

        return of(null);
      }),
    );
  }
}

import { AsyncPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, type Observable, of } from 'rxjs';

import { SHARED_DISPLAY_LABELS } from '../../core/constants/system-status.constants';
import type { SystemStatus } from '../../core/models/system-status.model';
import { SystemStatusApiService } from '../../core/services/system-status-api.service';
import { DASHBOARD_MESSAGES } from './constants/dashboard.constants';

@Component({
  selector: 'app-dashboard',
  imports: [AsyncPipe, DatePipe, MatButtonModule, MatCardModule, MatProgressSpinnerModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly systemStatusApiService = inject(SystemStatusApiService);

  protected readonly displayLabels = SHARED_DISPLAY_LABELS;

  protected readonly errorMessage = signal<string | null>(null);

  protected systemStatus$ = this.loadSystemStatus();

  protected reload(): void {
    this.errorMessage.set(null);
    this.systemStatus$ = this.loadSystemStatus();
  }

  private loadSystemStatus(): Observable<SystemStatus | null> {
    return this.systemStatusApiService.getSystemStatus().pipe(
      catchError((error: HttpErrorResponse) => {
        this.errorMessage.set(error.message || DASHBOARD_MESSAGES.STATUS_LOAD_FAILED);

        return of(null);
      }),
    );
  }
}

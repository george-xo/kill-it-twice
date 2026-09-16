import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { filter, finalize, type Observable, switchMap, take, tap, timeout, timer } from 'rxjs';

import {
  SHARED_DISPLAY_LABELS,
  WORKER_STATUSES,
} from '../../core/constants/system-status.constants';
import type { SystemStatus } from '../../core/models/system-status.model';
import { SystemStatusApiService } from '../../core/services/system-status-api.service';
import {
  createDlqReplayFailureMessage,
  createDlqReplaySuccessMessage,
  DEFAULT_DLQ_REPLAY_LIMIT,
  DLQ_REPLAY_TIMEOUT_MS,
  MAX_DLQ_REPLAY_LIMIT,
  OPERATIONS_LABELS,
  OPERATIONS_MESSAGES,
  WORKER_NAMES,
  WORKER_STATUS_POLL_INTERVAL_MS,
  WORKER_STATUS_TIMEOUT_MS,
} from './constants/operations.constants';
import type { DeadLetterReplayResponse, WorkerCommandResponse } from './models/operation.model';
import { OperationsApiService } from './services/operations-api.service';
import { SimulationControlsComponent } from './simulation-control/simulation-controls.component';

@Component({
  selector: 'app-operations',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    SimulationControlsComponent,
  ],
  templateUrl: './operations.component.html',
  styleUrl: './operations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationsComponent implements OnInit {
  private readonly operationsApiService = inject(OperationsApiService);

  private readonly systemStatusApiService = inject(SystemStatusApiService);

  private readonly destroyRef = inject(DestroyRef);

  protected readonly workerStatuses = WORKER_STATUSES;
  protected readonly displayLabels = SHARED_DISPLAY_LABELS;
  protected readonly operationLabels = OPERATIONS_LABELS;

  protected readonly systemStatus = signal<SystemStatus | null>(null);

  protected readonly isBusy = signal(false);
  protected readonly isReplaying = signal(false);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly maximumDlqReplayLimit = MAX_DLQ_REPLAY_LIMIT;

  protected readonly replayLimit = new FormControl(DEFAULT_DLQ_REPLAY_LIMIT, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(1), Validators.max(MAX_DLQ_REPLAY_LIMIT)],
  });

  ngOnInit(): void {
    this.loadSystemStatus();
  }

  protected refreshStatus(): void {
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.loadSystemStatus();
  }

  protected startBackfill(): void {
    this.executeWorkerCommand(this.operationsApiService.startBackfill());
  }

  protected stopBackfill(): void {
    this.executeWorkerCommand(this.operationsApiService.stopBackfill());
  }

  protected startIncrementalSync(): void {
    this.executeWorkerCommand(this.operationsApiService.startIncrementalSync());
  }

  protected stopIncrementalSync(): void {
    this.executeWorkerCommand(this.operationsApiService.stopIncrementalSync());
  }

  protected replayDeadLetterQueue(): void {
    if (this.replayLimit.invalid) {
      this.replayLimit.markAsTouched();
      return;
    }

    this.prepareRequest();
    this.isReplaying.set(true);

    this.operationsApiService
      .replayDeadLetterQueue(this.replayLimit.getRawValue())
      .pipe(
        timeout(DLQ_REPLAY_TIMEOUT_MS),
        finalize(() => {
          this.isBusy.set(false);
          this.isReplaying.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.updateDeadLetterQueue(response);
          this.setReplayResultMessage(response);
        },
        error: () => {
          this.errorMessage.set(OPERATIONS_MESSAGES.DLQ_REPLAY_FAILED);
        },
      });
  }

  private loadSystemStatus(): void {
    this.isBusy.set(true);

    this.systemStatusApiService
      .getSystemStatus()
      .pipe(
        finalize(() => {
          this.isBusy.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (status) => {
          this.systemStatus.set(status);
        },
        error: () => {
          this.errorMessage.set(OPERATIONS_MESSAGES.STATUS_LOAD_FAILED);
        },
      });
  }

  private executeWorkerCommand(request: Observable<WorkerCommandResponse>): void {
    this.prepareRequest();

    request
      .pipe(
        tap(() => {
          this.successMessage.set(OPERATIONS_MESSAGES.WORKER_REQUEST_ACCEPTED);
        }),
        switchMap((response) => this.waitForWorkerState(response)),
        finalize(() => {
          this.isBusy.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (status) => {
          this.systemStatus.set(status);
        },
        error: () => {
          this.errorMessage.set(OPERATIONS_MESSAGES.WORKER_UPDATE_FAILED);
        },
      });
  }

  private waitForWorkerState(response: WorkerCommandResponse): Observable<SystemStatus> {
    return timer(0, WORKER_STATUS_POLL_INTERVAL_MS).pipe(
      switchMap(() => this.systemStatusApiService.getSystemStatus()),
      filter((status) => this.hasWorkerReachedRequestedState(status, response)),
      take(1),
      timeout(WORKER_STATUS_TIMEOUT_MS),
    );
  }

  private hasWorkerReachedRequestedState(
    status: SystemStatus,
    response: WorkerCommandResponse,
  ): boolean {
    const worker =
      response.worker === WORKER_NAMES.BACKFILL
        ? status.workers.backfill
        : status.workers.incrementalSync;

    if (!worker) {
      return false;
    }

    if (
      response.worker === WORKER_NAMES.BACKFILL &&
      response.requestedState === WORKER_STATUSES.RUNNING
    ) {
      return (
        worker.status === WORKER_STATUSES.RUNNING || worker.status === WORKER_STATUSES.COMPLETED
      );
    }

    return worker.status === response.requestedState;
  }

  private prepareRequest(): void {
    this.isBusy.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);
  }

  private setReplayResultMessage(response: DeadLetterReplayResponse): void {
    if (response.failed > 0) {
      this.errorMessage.set(
        createDlqReplayFailureMessage(response.replayed, response.failed, response.remaining),
      );

      return;
    }

    this.successMessage.set(createDlqReplaySuccessMessage(response.replayed, response.remaining));
  }

  private updateDeadLetterQueue(response: DeadLetterReplayResponse): void {
    this.systemStatus.update((status) => {
      if (!status) {
        return null;
      }

      return {
        ...status,
        pipeline: {
          ...status.pipeline,
          deadLetterQueueMessageCount: response.remaining,
        },
      };
    });
  }
}

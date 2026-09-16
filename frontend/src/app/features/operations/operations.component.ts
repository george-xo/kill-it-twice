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
import type { Observable } from 'rxjs';
import { finalize } from 'rxjs';

import type { SystemStatus } from '../../core/models/system-status.model';
import { SystemStatusApiService } from '../../core/services/system-status-api.service';
import {
  createDlqReplayFailureMessage,
  createDlqReplaySuccessMessage,
  DEFAULT_DLQ_REPLAY_LIMIT,
  MAX_DLQ_REPLAY_LIMIT,
  OPERATIONS_MESSAGES,
} from './constants/operations.constants';
import type { DeadLetterReplayResponse, WorkerCommandResponse } from './models/operation.model';
import { OperationsApiService } from './services/operations-api.service';
import { SimulationControlsComponent } from './simulation-control/simulation-controls.component';

@Component({
  selector: 'app-operations',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
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

  protected readonly systemStatus = signal<SystemStatus | null>(null);
  protected readonly isBusy = signal(false);
  protected readonly isReplaying = signal(false);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

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
        finalize(() => {
          this.isBusy.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.updateWorkerState(response);
          this.successMessage.set(OPERATIONS_MESSAGES.WORKER_UPDATED);
        },
        error: () => {
          this.errorMessage.set(OPERATIONS_MESSAGES.WORKER_UPDATE_FAILED);
        },
      });
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

  private updateWorkerState(response: WorkerCommandResponse): void {
    this.systemStatus.update((status) => {
      if (!status) {
        return null;
      }

      return {
        ...status,
        workers: {
          ...status.workers,
          [response.worker]: {
            ...status.workers[response.worker],
            status: response.requestedState,
            stopRequested: response.requestedState === 'stopped',
          },
        },
      };
    });
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

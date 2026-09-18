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
import { finalize, type Observable } from 'rxjs';

import {
  DEFAULT_SIMULATION_CUSTOMER_ID,
  SIMULATION_DESTINATIONS,
  SIMULATION_LABELS,
  SIMULATION_MESSAGES,
} from '../constants/simulation.constants';
import type {
  PoisonChangeResult,
  SimulatedCustomerChange,
  SimulationDestination,
  SimulationState,
} from '../models/simulation.model';
import { SimulationApiService } from '../services/simulation-api.service';

@Component({
  selector: 'app-simulation-controls',
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  templateUrl: './simulation-controls.component.html',
  styleUrl: './simulation-controls.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationControlsComponent implements OnInit {
  private readonly simulationApiService = inject(SimulationApiService);

  private readonly destroyRef = inject(DestroyRef);

  protected readonly simulationDestinations = SIMULATION_DESTINATIONS;

  protected readonly simulationLabels = SIMULATION_LABELS;

  protected readonly simulationState = signal<SimulationState | null>(null);

  protected readonly lastCustomerChange = signal<SimulatedCustomerChange | null>(null);

  protected readonly lastPoisonChange = signal<PoisonChangeResult | null>(null);

  protected readonly isBusy = signal(false);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly customerId = new FormControl(DEFAULT_SIMULATION_CUSTOMER_ID, {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d+$/)],
  });

  ngOnInit(): void {
    this.loadSimulationState();
  }

  protected failDestination(destination: SimulationDestination): void {
    this.executeStateChange(this.simulationApiService.failDestination(destination));
  }

  protected recoverDestination(destination: SimulationDestination): void {
    this.executeStateChange(this.simulationApiService.recoverDestination(destination));
  }

  protected recoverAllDestinations(): void {
    this.executeStateChange(this.simulationApiService.recoverAllDestinations());
  }

  protected toggleCustomerStatus(): void {
    if (this.customerId.invalid) {
      this.customerId.markAsTouched();
      return;
    }

    this.prepareRequest();

    this.simulationApiService
      .toggleCustomerStatus(this.customerId.getRawValue())
      .pipe(
        finalize(() => {
          this.isBusy.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.lastCustomerChange.set(result);

          this.successMessage.set(SIMULATION_MESSAGES.CUSTOMER_UPDATED);
        },
        error: () => {
          this.errorMessage.set(SIMULATION_MESSAGES.ACTION_FAILED);
        },
      });
  }

  protected createPoisonChange(): void {
    this.prepareRequest();

    this.simulationApiService
      .createPoisonChange()
      .pipe(
        finalize(() => {
          this.isBusy.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.lastPoisonChange.set(result);

          this.successMessage.set(SIMULATION_MESSAGES.POISON_CHANGE_CREATED);
        },
        error: () => {
          this.errorMessage.set(SIMULATION_MESSAGES.ACTION_FAILED);
        },
      });
  }

  private loadSimulationState(): void {
    this.simulationApiService
      .getState()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.simulationState.set(state);
        },
        error: () => {
          this.errorMessage.set(SIMULATION_MESSAGES.STATE_LOAD_FAILED);
        },
      });
  }

  private executeStateChange(request: Observable<SimulationState>): void {
    this.prepareRequest();

    request
      .pipe(
        finalize(() => {
          this.isBusy.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (state) => {
          this.simulationState.set(state);

          this.successMessage.set(SIMULATION_MESSAGES.DESTINATION_UPDATED);
        },
        error: () => {
          this.errorMessage.set(SIMULATION_MESSAGES.ACTION_FAILED);
        },
      });
  }

  private prepareRequest(): void {
    this.isBusy.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);
  }
}

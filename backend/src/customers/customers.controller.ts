import { Controller, Get, Param, Query } from '@nestjs/common';

import type { CustomerPayload } from '../pipeline/contracts/customer-change-event.contract.js';
import {
  CustomerQueryService,
  type CustomerListResponse,
  type CustomerQueryParameters,
} from './customer-query.service.js';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customerQueryService: CustomerQueryService) {}

  @Get()
  findAll(
    @Query() parameters: CustomerQueryParameters,
  ): Promise<CustomerListResponse> {
    return this.customerQueryService.findAll(parameters);
  }

  @Get(':customerId')
  findById(@Param('customerId') customerId: string): Promise<CustomerPayload> {
    return this.customerQueryService.findById(customerId);
  }
}

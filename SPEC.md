# Kill It Twice — Specifications

ამ დირექტორიაში ინახება თითოეული Pull Request-ის დავალება, scope და მიღებული შედეგი.

ყოველი ახალი ეტაპის specification იწერება შესაბამისი კოდის დაწყებამდე. სამუშაოს დასრულების შემდეგ იმავე ფაილში ემატება მიღებული შედეგი და გეგმიდან გადახვევები.

## Specifications

| PR  | თემა                                     | Specification                                                                        | სტატუსი   |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------ | --------- |
| 01  | საწყისი დოკუმენტაცია                     | [specs/01-initial-documentation.md](./specs/01-initial-documentation.md)             | Completed |
| 02  | პროექტის მომზადება                       | [specs/02-project-bootstrap.md](./specs/02-project-bootstrap.md)                     | Completed |
| 03  | Source მონაცემები და Seed                | [specs/03-source-and-seed.md](./specs/03-source-and-seed.md)                         | Completed |
| 04  | Elasticsearch და RabbitMQ-ში მიწოდება    | [specs/04-delivery-foundation.md](./specs/04-delivery-foundation.md)                 | Completed |
| 05  | G1 — Backfill crash recovery             | [specs/05-backfill-crash-recovery.md](./specs/05-backfill-crash-recovery.md)         | Completed |
| 06  | Backfill და Incremental Sync პარალელურად | [specs/06-concurrent-incremental-sync.md](./specs/06-concurrent-incremental-sync.md) | Completed |
| 07  | G2 — დუბლირებული event-ების დამუშავება   | [specs/07-duplicate-handling.md](./specs/07-duplicate-handling.md)                   | Completed |
| 08  | G3 — Destination failure და აღდგენა      | [specs/08-destination-recovery.md](./specs/08-destination-recovery.md)               | Completed |
| 09  | G4 — ნაწილობრივი Batch და DLQ            | [specs/09-partial-batch-and-dlq.md](./specs/09-partial-batch-and-dlq.md)             | Completed |
| 10  | G5 — მეტრიკები და სისტემის მდგომარეობა   | [specs/10-observability.md](./specs/10-observability.md)                             | Completed |
| 11  | G1–G5 საბოლოო Verification               | [specs/11-verification-harness.md](./specs/11-verification-harness.md)               | Completed |
| 12  | Angular Control Panel                    | [specs/12-angular-control-panel.md](./specs/12-angular-control-panel.md)             | Completed |
| 13  | საბოლოო Checks და Script Validation      | [specs/13-final-checks.md](./specs/13-final-checks.md)                               | Planned   |

შემდეგი specification-ები პროექტის განვითარებასთან ერთად დაემატება.

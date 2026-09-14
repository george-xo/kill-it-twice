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
| 09  | G4 — ნაწილობრივი Batch და DLQ            | [specs/09-partial-batch-and-dlq.md](./specs/09-partial-batch-and-dlq.md)             | Planned   |

შემდეგი specification-ები პროექტის განვითარებასთან ერთად დაემატება.

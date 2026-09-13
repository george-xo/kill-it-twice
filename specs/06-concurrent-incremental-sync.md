# PR 06 — Backfill და Incremental Sync პარალელურად

## დავალება

Backfill-ის პარალელურად მუდმივი Incremental Sync worker-ის გაშვება.

Backfill ამუშავებს სინქრონიზაციის დაწყებამდე არსებულ customer-ებს, ხოლო Incremental Sync — დაწყების შემდეგ `change_log`-ში დამატებულ ცვლილებებს.

ორივე პროცესმა ერთი საერთო boundary უნდა გამოიყენოს, რათა მათ შორის მონაცემი არ დაიკარგოს.

## Scope

- Backfill-ისა და Incremental Sync-ის საერთო საწყისი boundary;
- `backfill_jobs` ცხრილში `incremental_start_change_id` ველის დამატება;
- Incremental Sync-ის მდგომარეობისა და checkpoint-ის შესანახი ცხრილი;
- `change_log`-ის მუდმივი polling;
- ცვლილებების batch-ებად დამუშავება;
- checkpoint-ის ყოველი წარმატებული batch-ის შემდეგ შენახვა;
- worker-ის graceful shutdown;
- restart-ის შემდეგ შენახული checkpoint-იდან გაგრძელება;
- Incremental Sync-ის დამოუკიდებელი NestJS module და entrypoint;
- Incremental Sync-ის დამოუკიდებელი Docker Compose service;
- PR05-ის შემდეგ აღმოჩენილი verification და seed პრობლემების გამოსწორება.

## საერთო boundary

Backfill job-ის პირველად შექმნისას ერთი SQL statement-ით ინახება ორი მნიშვნელობა:

- `snapshot_max_id` — ბოლო customer ID, რომელიც Backfill-მა უნდა დაამუშაოს;
- `incremental_start_change_id` — ბოლო `change_log.id`, რომლის შემდეგაც Incremental Sync იწყებს მუშაობას.

მაგალითად:

- `snapshot_max_id = 10000`;
- `incremental_start_change_id = 10000`.

Backfill ამუშავებს customer-ებს ID `1`-დან `10000`-ის ჩათვლით.

Incremental Sync კითხულობს მხოლოდ იმ ცვლილებებს, რომელთა `change_log.id` მეტია `10000`-ზე.

ორივე მნიშვნელობა ერთ SQL statement-ში იკითხება, რათა PostgreSQL-ის ერთი statement snapshot გამოიყენონ და Backfill-სა და Incremental Sync-ს შორის gap არ დარჩეს.

## Incremental Sync-ის მდგომარეობა

`incremental_sync_jobs` ცხრილი ინახავს:

- job-ის სახელს;
- სტატუსს;
- საწყის `change_log` ID-ს;
- ბოლო დამუშავებულ `change_log` ID-ს;
- დამუშავებული ჩანაწერების რაოდენობას;
- დაწყებისა და განახლების დროს;
- ბოლო შეცდომას.

Worker-ის შესაძლო სტატუსებია:

- `pending`;
- `running`;
- `stopped`;
- `failed`.

## მუშაობის პრინციპი

Incremental Sync:

1. იღებს Backfill-ის მიერ დაფიქსირებულ `incremental_start_change_id` boundary-ს;
2. ქმნის ან კითხულობს საკუთარ persistent job-ს;
3. იწყებს `change_log`-ის კითხვას შენახული checkpoint-ის შემდეგ;
4. ცვლილებებს batch-ებად აგზავნის Elasticsearch-სა და RabbitMQ-ში;
5. წარმატებული batch-ის შემდეგ ინახავს ახალ checkpoint-ს;
6. თუ ახალი ცვლილება არ არსებობს, configured დროით იცდის და ისევ ამოწმებს;
7. restart-ის შემდეგ აგრძელებს ბოლო შენახული checkpoint-იდან.

## კონფიგურაცია

Incremental Sync-ის მართვისთვის დაემატა:

- `INCREMENTAL_SYNC_BATCH_SIZE`;
- `INCREMENTAL_SYNC_POLL_INTERVAL_MS`.

საწყისი მნიშვნელობებია:

- batch size — `100`;
- polling interval — `1000` მილიწამი.

## წარმატების კრიტერიუმები

- [x] Backfill და Incremental Sync დამოუკიდებელ worker-ებად ეშვება;
- [x] ორივე worker ერთ საერთო boundary-ს იყენებს;
- [x] Backfill საწყის snapshot-ს ამუშავებს;
- [x] Incremental Sync მხოლოდ boundary-ის შემდეგ შექმნილ ცვლილებებს კითხულობს;
- [x] ახალი ცვლილება Elasticsearch-ში ავტომატურად აისახება;
- [x] იგივე ცვლილება RabbitMQ consumer-მდე აღწევს;
- [x] ყოველი წარმატებული batch-ის შემდეგ checkpoint ინახება;
- [x] graceful shutdown-ის დროს job-ის სტატუსი `stopped` ხდება;
- [x] restart-ის შემდეგ worker შენახული checkpoint-იდან აგრძელებს;
- [x] Seed ძველ Backfill და Incremental Sync state-ს ასუფთავებს;
- [x] G1 verification რეალურად ამოწმებს დაკარგულ customer ID-ებს;
- [x] Backend build და lint წარმატებით სრულდება;
- [x] Docker Compose configuration სწორია.

## შედეგი

Backfill და Incremental Sync დამოუკიდებელ Docker service-ებად გაეშვა.

ტესტის დროს ორივემ გამოიყენა შემდეგი საერთო boundary:

- Backfill snapshot max customer ID — `10000`;
- Incremental Sync start change ID — `10000`.

Incremental Sync-ის მუშაობის დროს customer `1` ორჯერ შეიცვალა. Worker-მა ავტომატურად დაამუშავა `change_log` ჩანაწერები `10001` და `10002`.

საბოლოო მდგომარეობა იყო:

- Incremental Sync start ID — `10000`;
- ბოლო checkpoint — `10002`;
- დამუშავებული incremental ცვლილებები — `2`;
- Elasticsearch document version — `3`;
- RabbitMQ consumer-მა მიიღო `customer:1:3` event;
- RabbitMQ queue-ში დარჩენილი message-ების რაოდენობა — `0`.

Graceful shutdown-ის შემდეგ job-ის სტატუსი გახდა `stopped`. ხელახლა გაშვებისას worker-მა მუშაობა გააგრძელა change ID `10002`-ის შემდეგ.

## მუშაობისას აღმოჩენილი პრობლემები და ცვლილებები

### G1 verification დაკარგულ ჩანაწერებს რეალურად არ ამოწმებდა

PR05-ის verification Elasticsearch-ისა და PostgreSQL-ის ჩანაწერების მხოლოდ რაოდენობებს ადარებდა. თანაბარი რაოდენობა არ ამტკიცებს, რომ ორივე სისტემაში ზუსტად ერთი და იგივე customer ID-ებია.

Verification-ში დაემატა PostgreSQL customer ID-ების Elasticsearch `_mget` მოთხოვნით შემოწმება.

Negative test-ის დროს Elasticsearch-იდან ერთი document ხელით წაიშალა და შემოწმებამ `Missing records = 1` დააბრუნა.

სრული G1 verification-ის საბოლოო შედეგი იყო:

- Source records — `10000`;
- Elasticsearch records — `10000`;
- RabbitMQ events — `10000`;
- Missing records — `0`.

### Seed ძველ Backfill state-ს ტოვებდა

ახალი Seed `customers` და `change_log` ცხრილებს ასუფთავებდა, მაგრამ ძველი `backfill_jobs` ჩანაწერი რჩებოდა `completed` მდგომარეობაში.

ამის გამო ახალი მონაცემების შექმნის შემდეგ Backfill-ს შეიძლებოდა ჩაეთვალა, რომ სამუშაო უკვე დასრულებული იყო.

Seed-ის reset-ში დაემატა:

- `backfill_jobs`;
- `incremental_sync_jobs`.

ახლა ახალი Seed source მონაცემებთან ერთად ორივე worker-ის ძველ checkpoint-სა და state-საც ასუფთავებს.

### Seed გაშვებულ Backend container-ზე იყო დამოკიდებული

`make seed` თავდაპირველად `docker compose exec`-ს იყენებდა და მხოლოდ მაშინ მუშაობდა, როდესაც Backend container უკვე გაშვებული იყო.

ბრძანება შეიცვალა `docker compose run --rm` მიდგომით. ახლა Seed-ისთვის დროებითი Backend container იქმნება და მუდმივად გაშვებული Backend service საჭირო აღარ არის.

### Seed destination სისტემებს არ ასუფთავებს

Manual ტესტების დროს გამოჩნდა, რომ Seed PostgreSQL source მონაცემებსა და worker state-ს ასუფთავებს, მაგრამ Elasticsearch index-სა და RabbitMQ queue-ს არ შლის.

ამის გამო განმეორებით manual ტესტებში Elasticsearch-სა და RabbitMQ-ში წინა გაშვების მონაცემები შეიძლება დარჩეს.

ეს Seed-ის პასუხისმგებლობაში არ გადადის. სუფთა integration verification-ის setup-მა ცალ-ცალკე უნდა გაასუფთაოს:

- PostgreSQL;
- Elasticsearch;
- RabbitMQ.

### Backfill-ისა და Incremental Sync-ის გადაფარვა

Backfill-სა და Incremental Sync-ს ერთ customer-ზე ერთი და იგივე version-ის event-ის გაგზავნა შეუძლიათ.

Elasticsearch ამას customer ID-ისა და external version-ის საშუალებით უსაფრთხოდ ამუშავებს, მაგრამ RabbitMQ consumer-მა ერთი event შეიძლება განმეორებით მიიღოს.

Consumer idempotency ამ PR-ში არ შედის და G2-ში დაემატება.

## მიგრაციების შესახებ მიღებული გადაწყვეტილება

ამ ეტაპზე database migration-ები custom Migration Runner-ით სრულდება, ხოლო PostgreSQL schema, constraint-ები, index-ები, trigger-ები და query-ები ხელით დაწერილი SQL-ით იქმნება.

ეს მიდგომა შეგნებულად ავირჩიე, რათა უკეთ გავერკვე:

- როგორ იქმნება database schema;
- როგორ მუშაობს SQL query;
- როგორ გამოიყენება transaction;
- როგორ მუშაობს constraint, index და trigger;
- როგორ ურთიერთობს Backend PostgreSQL-თან.

შემდეგ ვერსიებში პროექტს TypeORM დაემატება, რათა ORM-ის migration-ები, entity-ები, repository pattern და TypeScript-იდან database schema-ს მართვაც პრაქტიკულად გავიარო.

TypeORM-ის დამატებისას ცალკე აღვწერ ხელით დაწერილ SQL-სა და ORM მიდგომას შორის განსხვავებებსა და trade-off-ებს.

## ამ PR-ში არ შედის

- RabbitMQ consumer-ის idempotency;
- duplicate event-ების საბოლოო გამოტოვება;
- destination failure-ის retry და backoff;
- retry limit;
- ნაწილობრივ ჩავარდნილი batch;
- DLQ.

ეს ნაწილები შემდეგ Pull Request-ებში დაემატება.

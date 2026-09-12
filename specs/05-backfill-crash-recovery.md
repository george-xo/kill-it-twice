**# PR 05 — G1: Backfill-ის აღდგენა გათიშვის შემდეგ**

**## დავალება**

Backfill worker-მა PostgreSQL-ში უკვე არსებული customer-ები batch-ებად უნდა გადაიტანოს Elasticsearch-სა და RabbitMQ-ში.

თუ worker მუშაობის დროს `docker kill`-ით გაითიშა, ხელახლა გაშვების შემდეგ თავიდან არ უნდა დაიწყოს. მან მუშაობა ბოლო წარმატებით დასრულებული batch-ის შემდეგ უნდა გააგრძელოს და არცერთი ჩანაწერი არ უნდა დაკარგოს.

**## Scope**

- Backfill worker;
- customer-ების ID-ის მიხედვით batch-ებად წაკითხვა;
- Backfill-ის საწყისი ზედა ზღვრის შენახვა;
- PostgreSQL-ში მუდმივი checkpoint;
- ბოლო წარმატებული customer ID-ის დამახსოვრება;
- restart-ის შემდეგ არსებული checkpoint-იდან გაგრძელება;
- batch size-ის environment ცვლადით მართვა;
- ტესტისთვის batch-ებს შორის delay-ის მართვა;
- Backfill-ის სტატუსისა და ბოლო error-ის შენახვა;
- Docker Compose-ში Backfill worker;
- `docker kill` სცენარის ავტომატური შემოწმება;
- `make verify-g1` ბრძანება.

ამ PR-ში Incremental Sync, consumer idempotency, destination retry, DLQ და Observability არ შედის.

**## Backfill-ის საწყისი საზღვარი**

Backfill-ის პირველი გაშვებისას სისტემა PostgreSQL-იდან იღებს იმ მომენტში არსებულ ყველაზე დიდ customer ID-ს და ინახავს როგორც `snapshotMaxId`.

Backfill ამუშავებს მხოლოდ იმ customer-ებს, რომელთა ID ნაკლებია ან ტოლია `snapshotMaxId`-ის.

Backfill-ის დაწყების შემდეგ დამატებული customer-ები ამ პროცესში არ ხვდება. მათ Incremental Sync დაამუშავებს.

**## მონაცემების batch-ებად წაკითხვა**

Customer-ები იკითხება ID-ის ზრდადობით:

```sql
WHERE id > lastProcessedId
  AND id <= snapshotMaxId
ORDER BY id ASC
LIMIT batchSize
```

`OFFSET` არ გამოიყენება. შემდეგი batch ყოველთვის ბოლო წარმატებული customer ID-ის მიხედვით იკითხება.

**## Checkpoint-ის განახლება**

Checkpoint იცვლება მხოლოდ მაშინ, როდესაც მთლიანი batch წარმატებით მივა Elasticsearch-სა და RabbitMQ-ში.

```text
Batch დასრულდა → checkpoint განახლდა
Batch შუაში ჩავარდა → checkpoint არ შეიცვალა
Restart → იგივე batch თავიდან დამუშავდა
```

თუ worker delivery-ის შემდეგ, მაგრამ checkpoint-ის შენახვამდე გაითიშა, რამდენიმე event შეიძლება განმეორებით გაიგზავნოს. ეს შეესაბამება პროექტის at-least-once delivery მიდგომას.

**## Backfill-ის მდგომარეობა**

PostgreSQL-ის `backfill_jobs` ცხრილში ინახება:

- job-ის სახელი;
- მიმდინარე სტატუსი;
- `snapshot_max_id`;
- `last_processed_id`;
- `processed_count`;
- დაწყების დრო;
- ბოლო განახლების დრო;
- დასრულების დრო;
- ბოლო error.

გამოყენებული სტატუსებია:

- `pending`;
- `running`;
- `completed`;
- `failed`.

**## წარმატების კრიტერიუმები**

- [x] Customer-ები ID-ის მიხედვით batch-ებად იკითხება;
- [x] ყველა customer ერთდროულად მეხსიერებაში არ იტვირთება;
- [x] Backfill-ის დაწყებისას `snapshotMaxId` ერთხელ ინახება;
- [x] წარმატებული batch-ის შემდეგ checkpoint ახლდება;
- [x] წარუმატებელი batch-ის დროს checkpoint წინ არ გადადის;
- [x] `docker kill`-ის შემდეგ worker თავიდან არ იწყებს;
- [x] restart-ის შემდეგ worker ბოლო დასრულებული batch-ის შემდეგ აგრძელებს;
- [x] Backfill-ის დასრულების შემდეგ არცერთი customer არ არის დაკარგული;
- [x] Elasticsearch-ში source-ის შესაბამისი customer-ების რაოდენობაა;
- [x] RabbitMQ-ში Backfill event-ები ქვეყნდება;
- [x] Backfill worker Docker Compose-ით ეშვება;
- [x] G1 ავტომატურად მოწმდება `make verify-g1` ბრძანებით;
- [x] Backend build და lint წარმატებით სრულდება.

**## ავტომატური შემოწმების შედეგი**

```text
G1 resume after kill ............ PASS
Killed after checkpoint ......... 300
Resumed from checkpoint ......... 300
Source records .................. 10000
Elasticsearch records ........... 10000
RabbitMQ events ................. 10002
Missing records ................. 0
```

Worker checkpoint `300`-ზე გაითიშა და restart-ის შემდეგ მუშაობა ზუსტად იმავე checkpoint-იდან გააგრძელა.

RabbitMQ-ში source-ზე 2 event-ით მეტი მოხვდა. worker-ის მოკვლის მომენტში შემდეგი batch-იდან 2 event უკვე გაგზავნილი იყო, მაგრამ checkpoint ჯერ არ განახლებულა. restart-ის შემდეგ იგივე batch თავიდან დამუშავდა.

ეს შედეგი მოსალოდნელია at-least-once delivery-ის დროს. არცერთი ჩანაწერი არ დაკარგულა, ხოლო განმეორებული event-ების უვნებლად დამუშავება G2-ში დაემატება.

**## შედეგი**

შეიქმნა Backfill worker, რომელიც customer-ებს configurable ზომის batch-ებად კითხულობს და PR04-ში შექმნილი delivery pipeline-ით Elasticsearch-სა და RabbitMQ-ში აგზავნის.

Checkpoint ინახება PostgreSQL-ში და მხოლოდ მთლიანი batch-ის წარმატებით დასრულების შემდეგ ახლდება.

Backfill-ისთვის დაემატა ცალკე NestJS runner module და Docker Compose service. `make verify-g1` ავტომატურად ამზადებს სატესტო გარემოს, კლავს worker-ს მუშაობის შუაში, თავიდან უშვებს და საბოლოო მონაცემების რაოდენობას ამოწმებს.

**## მუშაობისას მიღებული გადაწყვეტილებები და ცვლილებები**

- `OFFSET`-ის ნაცვლად გამოყენებულია ID-ზე დაფუძნებული keyset pagination.
- ID და checkpoint მნიშვნელობები Node.js-ში string-ად იკითხება, რათა PostgreSQL-ის `BIGINT` მნიშვნელობებზე precision არ დაიკარგოს.
- Checkpoint ინახება მთლიანი batch-ის დასრულების შემდეგ. ამიტომ crash-ის შემთხვევაში შესაძლებელია ბოლო დაუსრულებელი batch-ის განმეორება, მაგრამ მონაცემი არ იკარგება.
- `BACKFILL_BATCH_DELAY_MS` დაემატა G1-ის ტესტისთვის, რათა worker ძალიან სწრაფად არ დასრულდეს და მისი შუაში მოკვლა შესაძლებელი იყოს.
- `docker kill`-ის შემდეგ job-ის სტატუსი `running` რჩება, რადგან პროცესი cleanup-ის გარეშე კვდება. restart-ის დროს ეს სტატუსი გასაგრძელებლად დაშვებულია.

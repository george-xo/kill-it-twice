# PR 04 — მონაცემების გადატანის საწყისი საფუძველი

## დავალება

`change_log`-ში არსებული customer-ის ცვლილებების წაკითხვა და Elasticsearch-სა და RabbitMQ-ში გაგზავნა. RabbitMQ-ში გაგზავნილ event-ებს ცალკე consumer მიიღებს.

## Scope

- Elasticsearch client და `customers` index;
- RabbitMQ connection, exchange, queue და binding;
- customer change event-ის საერთო ფორმატი;
- `change_log` ჩანაწერების batch-ად წაკითხვა;
- database row-ის pipeline event-ად გარდაქმნა;
- event-ის Elasticsearch-სა და RabbitMQ-ში გაგზავნა;
- დამოუკიდებელი RabbitMQ consumer;
- destination setup-ისა და consumer-ის Docker service-ები;
- INSERT, UPDATE და DELETE გზების ხელით შემოწმება.

ამ PR-ში Backfill worker, Incremental Sync, მუდმივი checkpoint, retry limit, DLQ და consumer idempotency არ შედის.

## წარმატების კრიტერიუმები

- [x] Elasticsearch-ში `customers` index იქმნება;
- [x] RabbitMQ-ში exchange, queue და binding იქმნება;
- [x] `change_log` ჩანაწერები სწორი თანმიმდევრობით იკითხება;
- [x] customer event-ის ფორმატი ორივე destination-ისთვის საერთოა;
- [x] INSERT და UPDATE Elasticsearch-ში ერთსა და იმავე customer ID-ზე იწერება;
- [x] DELETE Elasticsearch-იდან customer document-ს შლის;
- [x] ყველა ცვლილება RabbitMQ-ში ქვეყნდება;
- [x] დამოუკიდებელი consumer event-ებს იღებს და `ack`-ს აკეთებს;
- [x] destination setup და consumer Docker Compose-ით ეშვება;
- [x] Backend build და lint წარმატებით სრულდება.

## შედეგი

შეიქმნა pipeline-ის საწყისი გზა:

`PostgreSQL change_log → mapper → Elasticsearch + RabbitMQ → consumer`

Elasticsearch customer-ის ID-ს document ID-ად და customer-ის version-ს external version-ად იყენებს. ამის გამო იგივე ან ძველი ჩანაწერი ახალ მდგომარეობას არ ანაცვლებს და ერთი customer-ისთვის დუბლირებული document არ იქმნება.

RabbitMQ-ში შეიქმნა `customer.events` exchange, `customer.events.consumer` queue და `customer.changed` routing key. შეტყობინებები persistent რეჟიმში იგზავნება და publisher RabbitMQ-ის დადასტურებას ელოდება.

Consumer ამ ეტაპზე event-ს იღებს, ლოგავს და წარმატებული დამუშავების შემდეგ `ack`-ს აკეთებს. დამუშავებული event ID-ების შენახვა და დუბლიკატების გამოტოვება G2-ში დაემატება.

## შემოწმების შედეგები

პირველი ტესტის დროს pipeline ორჯერ გაეშვა და ერთი event განმეორებით გაიგზავნა. შედეგად Elasticsearch-ში 9 უნიკალური document იყო, RabbitMQ-ში კი 10 event. ამით გამოჩნდა, რომ Elasticsearch იგივე ID-ს არ ადუბლირებს, ხოლო RabbitMQ consumer-ს idempotency ცალკე დასჭირდება.

UPDATE ტესტში customer `1` შეიცვალა `inactive` მდგომარეობაზე. Elasticsearch-ში იგივე document განახლდა და version გახდა `2`. RabbitMQ consumer-მა მიიღო `customer:1:2` UPDATE event.

DELETE ტესტში `change_log`-ში შეიქმნა version `3`. Elasticsearch-იდან customer `1` წაიშალა, ხოლო RabbitMQ-ში გამოქვეყნდა DELETE event.

## მუშაობისას აღმოჩენილი პრობლემები და ცვლილებები

- Destination setup თავდაპირველად მთლიან `AppModule`-ს ტვირთავდა და ზედმეტად იყო დამოკიდებული PostgreSQL-ზე. ამის ნაცვლად შეიქმნა ცალკე `DestinationSetupModule`.
- `AppModule`-ში destination module-ების დამატების შემდეგ migration-მაც Elasticsearch-ისა და RabbitMQ-ის ჩატვირთვა დაიწყო. Migration-ისთვის შეიქმნა ცალკე `DatabaseMigrationModule`, რომელიც მხოლოდ Config-სა და Database-ს იყენებს.
- `.env`-ში თავდაპირველად არ იყო `RABBITMQ_HOST`. `ConfigService.getOrThrow()`-მა გაშვება სწორად გააჩერა და მნიშვნელობა environment ფაილებსა და Docker Compose-ში დაემატა.
- `change_log.id` query-ში ტექსტად გარდაიქმნებოდა და შედეგები ლაგდებოდა როგორც `1, 10, 100, 1000`. დალაგება შეიცვალა ცხრილის საწყისი `BIGINT` სვეტით და სწორი შედეგი გახდა `1, 2, 3, 4, 5`.
- Consumer handler-ის ტიპი `Promise<void>`-დან `void | Promise<void>`-ზე შეიცვალა, რათა synchronous და asynchronous handler-ების გამოყენება შეიძლებოდეს.
- წარუმატებელი consumer handler ამ ეტაპზე event-ს queue-ში აბრუნებს. Retry limit და DLQ G4-ში დაემატება, რათა მუდმივად გაფუჭებული event უსასრულოდ არ ტრიალებდეს.

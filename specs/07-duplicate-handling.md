# PR 07 — G2: დუბლირებული event-ების დამუშავება

## დავალება

RabbitMQ consumer-ში განმეორებით მიღებული event-ების უსაფრთხოდ დამუშავება.

Pipeline იყენებს at-least-once delivery-ს, ამიტომ ერთი event შეიძლება რამდენჯერმე გაიგზავნოს. Consumer-მა ერთი event-ის შედეგი მხოლოდ ერთხელ უნდა შეინახოს.

## Scope

- დამუშავებული event-ების PostgreSQL-ში შენახვა;
- duplicate event-ის ამოცნობა;
- duplicate event-ის გამოტოვება და ACK;
- consumer restart-ის შემდეგ idempotency-ის შენარჩუნება;
- იგივე customer-ის ახალი version-ის დამოუკიდებლად დამუშავება;
- Seed-ის დროს consumer state-ის გასუფთავება;
- `make verify-g2` ავტომატური შემოწმება.

## მუშაობის პრინციპი

Event-ის უნიკალური ID არის:

`customer:{entityId}:{entityVersion}`

მაგალითად:

`customer:10000:2`

დაემატა `consumer_processed_events` ცხრილი, რომლის primary key არის:

`consumer_name + event_id`

Consumer event-ის მიღებისას ასრულებს:

`INSERT ... ON CONFLICT DO NOTHING`

თუ ჩანაწერი შეიქმნა, event პირველად დამუშავდა.

თუ primary key უკვე არსებობს, event duplicate-ია, მეორედ აღარ ინახება და RabbitMQ message ACK-დება.

Consumer-ის სახელი primary key-ის ნაწილია, რათა მომავალში სხვადასხვა consumer-მა ერთი event დამოუკიდებლად დაამუშაოს.

## წარმატების კრიტერიუმები

- [x] ერთი event persistent storage-ში მხოლოდ ერთხელ ინახება;
- [x] duplicate event მეორედ არ მუშავდება;
- [x] duplicate event წარმატებით ACK-დება;
- [x] restart-ის შემდეგ idempotency state არ იკარგება;
- [x] ახალი customer version ახალ event-ად მუშავდება;
- [x] Seed ძველ consumer state-ს ასუფთავებს;
- [x] Elasticsearch duplicate document-ს არ ქმნის;
- [x] `make verify-g2` წარმატებით სრულდება;
- [x] Backend build და lint წარმატებით სრულდება.

## შედეგი

ტესტის დროს `customer:10000:1` event რამდენჯერმე გამოქვეყნდა.

პირველი event დამუშავდა, ხოლო შემდეგი შეტყობინებები duplicate-ად იქნა ამოცნობილი. Consumer restart-ის შემდეგ იგივე event კვლავ duplicate-ად ჩაითვალა.

`customer:10000:2` ახალი version იყო და წარმატებით დამუშავდა.

`make verify-g2` შედეგი:

- G2 duplicate handling — `PASS`;
- ერთი event-ის გამოქვეყნების რაოდენობა — `3`;
- უნიკალურად დამუშავებული event-ები — `2`;
- Elasticsearch document-ები — `1`;
- ბოლო customer version — `2`;
- RabbitMQ pending messages — `0`.

## მუშაობისას აღმოჩენილი პრობლემები და ცვლილებები

- Consumer-ს PostgreSQL connection არ ჰქონდა. დაემატა `DatabaseModule`, PostgreSQL environment variables და migration dependency.
- Consumer handler asynchronous გახდა, რათა ACK მხოლოდ database ოპერაციის დასრულების შემდეგ გაიგზავნოს.
- Seed-ის reset-ში დაემატა `consumer_processed_events`, რათა ახალი Seed event-ები ძველ duplicate-ებად არ ჩაითვალოს.
- `consume-customer-events` naming შენარჩუნდა, რადგან `consume` ამ entrypoint-ის მოქმედებას სწორად აღწერს.

## მიმდინარე შეზღუდვა

ამ ეტაპზე `consumer_processed_events` consumer-ის durable შედეგიცაა და idempotency marker-იც.

თუ მომავალში დამატებითი database side effect დაემატება, ის event-ის შენახვასთან ერთად ერთ transaction-ში უნდა შესრულდეს.

## ამ PR-ში არ შედის

- destination failure-ის retry და backoff;
- retry limit;
- ნაწილობრივ ჩავარდნილი batch;
- DLQ;
- TypeORM integration.

ეს ნაწილები შემდეგ Pull Request-ებში დაემატება.

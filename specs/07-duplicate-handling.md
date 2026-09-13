# PR 07 — G2: დუბლირებული event-ების დამუშავება

## დავალება

Elasticsearch-სა და RabbitMQ consumer-ში განმეორებით მიღებული customer event-ების უსაფრთხოდ დამუშავება.

Pipeline იყენებს at-least-once delivery მიდგომას, ამიტომ crash-ის, retry-ის ან Backfill-ისა და Incremental Sync-ის გადაფარვის დროს ერთი event შეიძლება რამდენჯერმე გაიგზავნოს.

G2-ის მიზანია განმეორებით მიღებულმა event-მა საბოლოო მდგომარეობა ან consumer-ის side effect მეორედ არ შეცვალოს.

## Scope

- customer event-ის უნიკალური ID-ის გამოყენება;
- Elasticsearch-ის version-based idempotency-ის ავტომატური შემოწმება;
- RabbitMQ consumer-ის persistent idempotency;
- დამუშავებული event ID-ების PostgreSQL-ში შენახვა;
- თითოეული consumer-ისთვის event processing state-ის ცალკე შენახვა;
- duplicate event-ის ამოცნობა;
- duplicate event-ის გამოტოვება და ACK;
- consumer restart-ის შემდეგ idempotency-ის შენარჩუნება;
- database transaction-ის გამოყენება;
- G2-ის ავტომატური verification;
- `make verify-g2` ბრძანების დამატება.

## Event-ის იდენტიფიკაცია

Customer event-ის უნიკალური ID იქმნება შემდეგი ფორმატით:

`customer:{entityId}:{entityVersion}`

მაგალითად:

`customer:9001:2`

ერთი customer-ის ერთი version ყოველთვის ერთსა და იმავე event ID-ს ქმნის.

## Elasticsearch

Elasticsearch-ში:

- customer ID გამოიყენება document ID-დ;
- customer version გამოიყენება external version-ად;
- იგივე ან ძველი version ახალ მდგომარეობას ვერ გადაწერს;
- განმეორებით გაგზავნა დამატებით document-ს არ ქმნის.

## RabbitMQ Consumer

Consumer მიღებულ event ID-ს persistent storage-ში შეამოწმებს.

თუ event ჯერ არ არის დამუშავებული:

1. consumer დაიწყებს database transaction-ს;
2. შეინახავს დამუშავებულ event-ს;
3. შეასრულებს consumer-ის side effect-ს;
4. დაასრულებს transaction-ს;
5. RabbitMQ-ს გაუგზავნის ACK-ს.

თუ იგივე event ხელახლა მივა:

1. consumer იპოვის უკვე შენახულ event ID-ს;
2. side effect-ს მეორედ აღარ შეასრულებს;
3. event-ს ACK-ს გაუგზავნის.

თუ consumer database commit-ის შემდეგ, მაგრამ RabbitMQ ACK-მდე გაითიშება, RabbitMQ event-ს ხელახლა გამოაგზავნის. Restart-ის შემდეგ consumer persistent state-ით ამოიცნობს duplicate-ს და side effect-ს აღარ გაიმეორებს.

## წარმატების კრიტერიუმები

- [ ] ერთი event-ის რამდენჯერმე გაგზავნა Elasticsearch-ში duplicate document-ს არ ქმნის;
- [ ] ძველი version Elasticsearch-ში ახალ მდგომარეობას ვერ გადაწერს;
- [ ] RabbitMQ consumer ერთი event ID-ის side effect-ს მხოლოდ ერთხელ ასრულებს;
- [ ] duplicate event წარმატებით ACK-დება;
- [ ] consumer-ის restart-ის შემდეგ დამუშავებული event-ების ისტორია არ იკარგება;
- [ ] crash-ის შემდეგ ხელახლა მიღებული event duplicate-ად ამოიცნობა;
- [ ] სხვადასხვა version-ის event-ები დამოუკიდებელ ცვლილებებად მუშავდება;
- [ ] `make verify-g2` ავტომატურად ამოწმებს duplicate სცენარს;
- [ ] Backend build და lint წარმატებით სრულდება.

## ამ PR-ში არ შედის

- Elasticsearch-ის ან RabbitMQ-ის გათიშვის retry policy;
- exponential backoff;
- retry limit;
- ნაწილობრივ ჩავარდნილი batch;
- DLQ;
- poison message-ის საბოლოო დამუშავება.

ეს ნაწილები შემდეგ Pull Request-ებში დაემატება.

## შედეგი

ჯერ არ არის შესრულებული.

## ცვლილებები საწყის გეგმასთან შედარებით

ჯერ ცვლილება არ არის.
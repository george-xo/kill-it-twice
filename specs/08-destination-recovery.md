# PR 08 — G3: Destination failure და აღდგენა

## დავალება

Elasticsearch-ის ან RabbitMQ-ის დროებითი გათიშვის დროს pipeline-მა event არ უნდა დაკარგოს და destination-ის აღდგენის შემდეგ მუშაობა ავტომატურად უნდა გააგრძელოს.

## Scope

- destination ოპერაციების retry;
- exponential backoff;
- retry პარამეტრების environment-ით მართვა;
- checkpoint-ის მხოლოდ ორივე destination-ის წარმატების შემდეგ შენახვა;
- RabbitMQ publisher-ის reconnect;
- RabbitMQ consumer-ის reconnect;
- `make verify-g3` ავტომატური შემოწმება.

## Retry configuration

- `DESTINATION_RETRY_MAX_ATTEMPTS=10`;
- `DESTINATION_RETRY_INITIAL_DELAY_MS=250`;
- `DESTINATION_RETRY_MAX_DELAY_MS=5000`.

დაყოვნება იზრდება დაახლოებით ასე:

`250ms → 500ms → 1s → 2s → 4s → 5s`

## წარმატების კრიტერიუმები

- [x] Elasticsearch-ის გათიშვის დროს checkpoint არ იზრდება;
- [x] Elasticsearch-ის აღდგენის შემდეგ event იგზავნება;
- [x] RabbitMQ-ის გათიშვის დროს checkpoint არ იზრდება;
- [x] RabbitMQ publisher ავტომატურად reconnect-დება;
- [x] RabbitMQ consumer ავტომატურად reconnect-დება;
- [x] აღდგენის შემდეგ queue მუშავდება;
- [x] `make verify-g3` წარმატებით სრულდება;
- [x] Backend build და lint წარმატებით სრულდება.

## შედეგი

დაემატა საერთო `DestinationRetryService`, რომელიც destination ოპერაციებს exponential backoff-ით იმეორებს.

Elasticsearch-ში გაგზავნა სრულდება RabbitMQ publish-მდე. Pipeline checkpoint-ს მხოლოდ ორივე ოპერაციის წარმატების შემდეგ ინახავს.

G3 verification-ის შედეგი:

- G3 destination recovery — `PASS`;
- საწყისი checkpoint — `10`;
- Elasticsearch-ის შემდეგ checkpoint — `11`;
- RabbitMQ-ის შემდეგ checkpoint — `12`;
- Consumer event-ები — `2`;
- RabbitMQ pending messages — `0`.

## აღმოჩენილი პრობლემა

პირველ ტესტში RabbitMQ publisher აღდგა, მაგრამ consumer broker-ის restart-ის შემდეგ აღარ reconnect-დებოდა.

Queue-ში event-ები რჩებოდა და `consumers = 0` იყო.

`RabbitMqService`-ს დაემატა consumer handler-ის შენახვა და reconnect loop. საბოლოო ტესტში consumer ავტომატურად დაბრუნდა, event დაამუშავა და queue დაცარიელდა.

## ამ PR-ში არ შედის

- ნაწილობრივ ჩავარდნილი batch;
- მუდმივად გაფუჭებული event;
- DLQ;
- TypeORM.

TypeORM G5-ის შემდეგ დაემატება.

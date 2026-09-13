# PR 08 — G3: Destination failure და აღდგენა

## დავალება

Elasticsearch-ის ან RabbitMQ-ის დროებითი გათიშვის დროს pipeline-მა event არ უნდა დაკარგოს და destination-ის აღდგენის შემდეგ მუშაობა ავტომატურად უნდა გააგრძელოს.

## Scope

- destination ოპერაციების retry;
- exponential backoff;
- retry configuration-ის environment-ით მართვა;
- checkpoint-ის მხოლოდ წარმატებული delivery-ის შემდეგ შენახვა;
- RabbitMQ publisher-ის reconnect;
- RabbitMQ consumer-ის reconnect;
- `make verify-g3` ავტომატური შემოწმება.

## წარმატების კრიტერიუმები

- [ ] Elasticsearch-ის გათიშვისას checkpoint არ იზრდება;
- [ ] Elasticsearch-ის აღდგენის შემდეგ delivery გრძელდება;
- [ ] RabbitMQ-ის გათიშვისას checkpoint არ იზრდება;
- [ ] RabbitMQ publisher ავტომატურად reconnect-დება;
- [ ] RabbitMQ consumer ავტომატურად reconnect-დება;
- [ ] აღდგენის შემდეგ დარჩენილი event-ები მუშავდება;
- [ ] `make verify-g3` წარმატებით სრულდება;
- [ ] G1 და G2 კვლავ მუშაობს.

## ამ PR-ში არ შედის

- ნაწილობრივ ჩავარდნილი batch;
- მუდმივად გაფუჭებული event;
- DLQ;
- TypeORM.

TypeORM G5-ის შემდეგ დაემატება.

## შედეგი

ჯერ არ არის შესრულებული.

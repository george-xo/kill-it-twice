# PR 04 — მონაცემების Elasticsearch-სა და RabbitMQ-ში გაგზავნა

## დავალება

PostgreSQL-ში არსებული customer-ის ცვლილების Elasticsearch-სა და RabbitMQ-ში გაგზავნის საწყისი გზის მომზადება.

ამ ეტაპის მიზანია ერთი ცვლილების თავიდან ბოლომდე გატარება და ორივე მიმღებ სისტემასთან კავშირის შემოწმება.

## Scope

- Elasticsearch client-ის დამატება;
- RabbitMQ client-ის დამატება;
- ორივე connection-ის ცალკე module-სა და service-ში მართვა;
- Elasticsearch index-ისა და mapping-ის შექმნა;
- RabbitMQ exchange-ისა და queue-ის შექმნა;
- customer-ის ცვლილებისთვის საერთო event ფორმატის შექმნა;
- `change_log` ჩანაწერის event-ად გარდაქმნა;
- event-ის Elasticsearch-ში ჩაწერა;
- event-ის RabbitMQ-ში გამოქვეყნება;
- დამოუკიდებელი RabbitMQ consumer-ის დამატება;
- ერთი სატესტო ცვლილების ორივე destination-ში მიღების შემოწმება.

## Event-ის საწყისი ფორმატი

თითოეული customer event უნდა შეიცავდეს:

- event-ის ID-ს;
- entity-ის ტიპს;
- customer-ის ID-ს;
- customer-ის version-ს;
- ოპერაციას — `INSERT`, `UPDATE` ან `DELETE`;
- customer-ის მონაცემებს;
- ცვლილების დროს.

Event-ის საბოლოო TypeScript ტიპი კოდის დაწყებამდე განისაზღვრება.

## Elasticsearch

Elasticsearch-ში customer-ის მიმდინარე მდგომარეობა უნდა შეინახოს.

Customer-ის ID გამოყენებული იქნება document ID-დ, რათა ერთი customer-ის მონაცემი ერთ document-ში ინახებოდეს.

`INSERT` და `UPDATE` ოპერაციები document-ს შექმნის ან განაახლებს. `DELETE` ოპერაცია შესაბამის document-ს წაშლის.

## RabbitMQ

Customer event გამოქვეყნდება RabbitMQ exchange-ში და გადავა შესაბამის queue-ში.

დამოუკიდებელი consumer queue-დან მიიღებს event-ს და წარმატებული დამუშავების შემდეგ ACK-ს გაუგზავნის.

## წარმატების კრიტერიუმები

- [ ] Backend წარმატებით უკავშირდება Elasticsearch-ს;
- [ ] Backend წარმატებით უკავშირდება RabbitMQ-ს;
- [ ] Elasticsearch index და mapping ავტომატურად იქმნება;
- [ ] RabbitMQ exchange და queue ავტომატურად იქმნება;
- [ ] `change_log` ჩანაწერი საერთო event ფორმატში გარდაიქმნება;
- [ ] customer-ის მიმდინარე მდგომარეობა Elasticsearch-ში იძებნება;
- [ ] იგივე ცვლილება RabbitMQ consumer-მდე აღწევს;
- [ ] Backend, consumer და ყველა საჭირო service Docker Compose-ით ეშვება.

## ამ PR-ში არ შედის

- Backfill-ის სრული პროცესი;
- Incremental Sync-ის მუდმივი worker;
- crash-ის შემდეგ checkpoint-იდან გაგრძელება;
- duplicate event-ების საბოლოო დამუშავება;
- destination-ის გათიშვის retry და backoff;
- ნაწილობრივ ჩავარდნილი batch;
- DLQ;
- Gate-ების საბოლოო ავტომატური შემოწმება.

ეს ნაწილები შემდეგ Pull Request-ებში ცალ-ცალკე დაემატება.

## შედეგი

ჯერ არ არის შესრულებული.

## ცვლილებები საწყის გეგმასთან შედარებით

ჯერ ცვლილება არ არის.

# PR 09 — G4: ნაწილობრივი Batch და DLQ

## დავალება

Batch-ში ერთი event-ის მუდმივი შეცდომის დროს დანარჩენი event-ების დამუშავება უნდა გაგრძელდეს.

Retry-ის ამოწურვის შემდეგ failed event DLQ-ში უნდა გადავიდეს და checkpoint არ უნდა გაჩერდეს.

## Scope

- failed destination-ის იდენტიფიკაცია;
- failed event-ის საერთო ფორმატი;
- RabbitMQ Dead Letter Exchange და Queue;
- retry-ის ამოწურვის შემდეგ DLQ publish;
- batch-ის შემდეგ event-ზე გაგრძელება;
- failed event-ის შემდეგ checkpoint-ის განახლება;
- `make verify-g4` ავტომატური შემოწმება.

## DLQ topology

დაემატა:

- Exchange — `customer.events.dlx`;
- Queue — `customer.events.dlq`;
- Routing key — `customer.failed`.

DLQ message ინახავს:

- საწყის customer event-ს;
- failed destination-ს;
- error message-ს;
- failure timestamp-ს.

## დამუშავების პრინციპი

თუ event-ის delivery retry-ების შემდეგაც ჩავარდა:

1. იქმნება `DestinationDeliveryError`;
2. event DLQ-ში იგზავნება;
3. RabbitMQ confirmation-ის მიღების შემდეგ batch შემდეგ event-ზე გადადის;
4. checkpoint batch-ის ბოლო დამუშავებულ ID-ზე ინახება.

თუ DLQ publish ვერ დადასტურდა ან უცნობი პროგრამული error მოხდა, batch ჩერდება და checkpoint წინ არ მიდის.

## წარმატების კრიტერიუმები

- [x] ერთი poison event მთელ batch-ს არ აჩერებს;
- [x] valid event-ები ორივე destination-ში აღწევს;
- [x] failed event DLQ-ში გადადის;
- [x] error-ის მიზეზი DLQ message-ში ინახება;
- [x] checkpoint failed event-ის შემდეგაც ახლდება;
- [x] main queue-ში მხოლოდ valid event-ები ხვდება;
- [x] `make verify-g4` წარმატებით სრულდება;
- [x] Backend build და lint წარმატებით სრულდება.

## შედეგი

ტესტისთვის შეიქმნა სამი event:

- პირველი — valid;
- მეორე — არასწორი Elasticsearch `status` ტიპით;
- მესამე — valid.

G4 verification-ის შედეგი:

- G4 partial batch and DLQ — `PASS`;
- დამუშავებული batch records — `3`;
- წარმატებული Elasticsearch documents — `2`;
- failed Elasticsearch documents — `1`;
- main queue messages — `2`;
- DLQ messages — `1`;
- საბოლოო checkpoint — `13`.

Poison event DLQ-ში გადავიდა, მესამე event წარმატებით დამუშავდა და checkpoint batch-ის ბოლომდე მივიდა.

## ცვლილებები

`DeliveryBatchResult`-ს დაემატა `failedCount`.

Destination-ებში გაგზავნა sequential-ია. Elasticsearch სრულდება RabbitMQ publish-მდე, ხოლო checkpoint მხოლოდ ორივე წარმატებული delivery-ის ან დადასტურებული DLQ publish-ის შემდეგ ინახება.

არსებულ main queue-ს dead-letter arguments არ დაემატა, რათა უკვე შექმნილ durable queue-სთან configuration conflict არ წარმოქმნილიყო. Pipeline failed event-ს პირდაპირ DLX-ში აქვეყნებს.

## ამ PR-ში არ შედის

- metrics და monitoring;
- მართვის API;
- Angular UI;
- TypeORM.

TypeORM G5-ის შემდეგ დაემატება.

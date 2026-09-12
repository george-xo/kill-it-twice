# PR 05 — G1: Backfill-ის აღდგენა გათიშვის შემდეგ

## დავალება

Backfill worker-მა PostgreSQL-ში უკვე არსებული customer-ები batch-ებად უნდა გადაიტანოს Elasticsearch-სა და RabbitMQ-ში.

თუ worker მუშაობის დროს `docker kill`-ით გაითიშა, ხელახლა გაშვების შემდეგ თავიდან არ უნდა დაიწყოს. მან მუშაობა ბოლო წარმატებით დასრულებული batch-ის შემდეგ უნდა გააგრძელოს და არცერთი ჩანაწერი არ უნდა დაკარგოს.

## Scope

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

## Backfill-ის საწყისი საზღვარი

Backfill-ის პირველი გაშვებისას სისტემა PostgreSQL-იდან აიღებს იმ მომენტში არსებულ ყველაზე დიდ customer ID-ს და შეინახავს როგორც `snapshotMaxId`.

Backfill დაამუშავებს მხოლოდ იმ customer-ებს, რომელთა ID ნაკლებია ან ტოლია `snapshotMaxId`-ის.

Backfill-ის დაწყების შემდეგ დამატებულ customer-ებს მომავალში Incremental Sync დაამუშავებს.

## Checkpoint-ის განახლება

Checkpoint უნდა შეიცვალოს მხოლოდ მაშინ, როდესაც მთლიანი batch წარმატებით მივა Elasticsearch-სა და RabbitMQ-ში.

თუ worker delivery-ის შემდეგ, მაგრამ checkpoint-ის შენახვამდე გაითიშება, რამდენიმე event შეიძლება განმეორებით გაიგზავნოს. ეს შეესაბამება პროექტის at-least-once delivery მიდგომას.

## წარმატების კრიტერიუმები

- [ ] Customer-ები ID-ის მიხედვით batch-ებად იკითხება;
- [ ] ყველა customer ერთდროულად მეხსიერებაში არ იტვირთება;
- [ ] Backfill-ის დაწყებისას `snapshotMaxId` ერთხელ ინახება;
- [ ] წარმატებული batch-ის შემდეგ checkpoint ახლდება;
- [ ] წარუმატებელი batch-ის დროს checkpoint წინ არ გადადის;
- [ ] `docker kill`-ის შემდეგ worker თავიდან არ იწყებს;
- [ ] restart-ის შემდეგ worker ბოლო დასრულებული batch-ის შემდეგ აგრძელებს;
- [ ] Backfill-ის დასრულების შემდეგ არცერთი customer არ იკარგება;
- [ ] Elasticsearch-ში source-ის შესაბამისი customer-ების რაოდენობაა;
- [ ] RabbitMQ-ში Backfill event-ები ქვეყნდება;
- [ ] Backfill worker Docker Compose-ით ეშვება;
- [ ] G1 ავტომატურად მოწმდება `make verify-g1` ბრძანებით;
- [ ] Backend build და lint წარმატებით სრულდება.

## შედეგი

ჯერ არ არის შესრულებული.

## ცვლილებები საწყის გეგმასთან შედარებით

ჯერ ცვლილება არ არის.

# PR 10 — G5: მეტრიკები, ლოგები და სისტემის მდგომარეობა

## დავალება

Pipeline-ის მიმდინარე მდგომარეობის, პროგრესისა და შეცდომების დაკვირვებადი გახდომა.

სისტემამ უნდა აჩვენოს მუშაობს თუ არა თითოეული dependency, სადამდე მივიდა Backfill და Incremental Sync და რამდენი event დამუშავდა ან ჩავარდა.

## Scope

- structured logging;
- Backfill-ის პროგრესის მეტრიკები;
- Incremental Sync-ის პროგრესი და checkpoint;
- processed, duplicate, retry და DLQ counters;
- PostgreSQL, Elasticsearch და RabbitMQ health checks;
- სისტემის საერთო status endpoint;
- Prometheus-compatible metrics endpoint;
- `make verify-g5` ავტომატური შემოწმება.

## წარმატების კრიტერიუმები

- [ ] dependency-ების health ცალ-ცალკე ჩანს;
- [ ] Backfill-ის status და პროგრესი ხელმისაწვდომია;
- [ ] Incremental Sync-ის status და checkpoint ხელმისაწვდომია;
- [ ] processed, duplicate, retry და DLQ რაოდენობები ჩანს;
- [ ] log-ები შეიცავს საჭირო context-სა და event ID-ს;
- [ ] `/metrics` endpoint Prometheus ფორმატს აბრუნებს;
- [ ] system status endpoint JSON პასუხს აბრუნებს;
- [ ] `make verify-g5` წარმატებით სრულდება;
- [ ] წინა Gate-ები კვლავ მუშაობს.

## ამ PR-ში არ შედის

- Angular dashboard;
- TypeORM;
- production deployment.

## შედეგი

ჯერ არ არის შესრულებული.

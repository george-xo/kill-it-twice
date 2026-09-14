# PR 10 — G5: Observability

## დავალება

Pipeline-ის მდგომარეობის, metrics-ისა და მნიშვნელოვანი მოვლენების მონიტორინგის დამატება.

## Scope

- PostgreSQL-ში საერთო metrics-ის შენახვა;
- Prometheus-ის `/metrics` endpoint;
- სისტემის `/status` endpoint;
- PostgreSQL-ის, Elasticsearch-ისა და RabbitMQ-ის availability;
- Backfill-ისა და Incremental Sync-ის მდგომარეობა;
- processed, duplicate, retry და DLQ counter-ები;
- structured JSON logs;
- `make verify-g5` ბრძანება.

## წარმატების კრიტერიუმები

- [x] `/metrics` აბრუნებს Prometheus counter-ებს;
- [x] `/status` აბრუნებს dependency-ებისა და worker-ების მდგომარეობას;
- [x] dependency-ის ან worker-ის ჩავარდნისას სისტემა ხდება `degraded`;
- [x] recovery-ის შემდეგ სისტემა ბრუნდება `healthy` მდგომარეობაში;
- [x] retry და consumer მოვლენები structured JSON ფორმატში ილოგება;
- [x] G5-ის ავტომატური verification დამატებულია.

## შედეგი

დაემატა persistent metrics, health/status ინფორმაცია და structured logging. Metrics სხვადასხვა container-იდან PostgreSQL-ში გროვდება და `/metrics` endpoint-ით Prometheus-ის ფორმატში გამოდის.

## აღმოჩენილი პრობლემა

Structured logs-ის დამატების შემდეგ G2–G4 verification scripts-ში ძველი ტექსტური log assertions მოძველდა. მათი გასწორება და ერთიანი `make verify` ანგარიშის აწყობა ცალკე PR11-ში შესრულდება.

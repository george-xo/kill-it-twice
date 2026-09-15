# PR 11 — Verification Harness

## დავალება

ხუთივე Gate-ის ერთი ბრძანებით შემოწმება და backend-ის Angular UI-სთვის მომზადება.

## Scope

- `make verify`-ით G1–G5-ის თანმიმდევრული გაშვება;
- მკაფიო საერთო PASS/FAIL ანგარიში;
- status, metrics და customer API;
- worker start/stop;
- failure და poison-event simulation;
- DLQ count და replay;
- Angular-ისთვის CORS.

## შედეგი

`make verify` ავტომატურად ამოწმებს ხუთივე Gate-ს:

- G1 — crash recovery და 0 lost;
- G2 — duplicate processing-ის გამორიცხვა;
- G3 — destination outage და recovery;
- G4 — 497 წარმატებული ჩანაწერი და 3 DLQ;
- G5 — health, metrics და structured logs.

Angular UI-სთვის მომზადდა dashboard, customer search/details, worker control, simulation და DLQ replay API-ები.

## ცვლილებები და აღმოჩენილი პრობლემები

G2-ის ძველი verification structured JSON log-ს არასწორად ამუშავებდა. შემოწმება რეალურ database შედეგებსა და metrics-ზე გადავიდა.

Worker control PostgreSQL-ში ინახება, რადგან backend-იდან Docker socket-ის მართვა უსაფრთხო არ არის.

RabbitMQ-ის ახალმა CLI-მ ძველი `key=value` publish ფორმატი არ მიიღო, ამიტომ DLQ ტესტისთვის ახალი CLI/HTTP API ფორმატი გამოიყენება.

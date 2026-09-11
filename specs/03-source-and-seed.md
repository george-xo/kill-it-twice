# PR 03 — Source მონაცემები და Seed

## დავალება

PostgreSQL-ში საწყისი მონაცემების სტრუქტურის შექმნა და configurable რაოდენობის სატესტო მომხმარებლების გენერაცია.

## Scope

- PostgreSQL migration-ების მომზადება;
- `customers` ცხრილის შექმნა;
- customer-ის `version` ველის დამატება;
- ცვლილებების შესანახად `change_log` ცხრილის შექმნა;
- საჭირო index-ების დამატება;
- მონაცემების batch-ებად გენერაცია;
- `make seed` ბრძანების დამატება;
- seed რაოდენობის parameter-ით მართვა.

Seed-ის გაშვების მაგალითი:

    make seed COUNT=100000

დიდი რაოდენობის მონაცემი ერთდროულად მეხსიერებაში არ იტვირთება. მომხმარებლები ნაწილებად იქმნება და PostgreSQL-ში batch-ებად იწერება.

ამ PR-ში მონაცემების Elasticsearch-სა და RabbitMQ-ში გაგზავნა არ შედის.

## მონაცემების საწყისი სტრუქტურა

პირველ ეტაპზე სისტემა ამუშავებს ერთ entity-ს — `customer`.

Customer-ის საწყისი ველებია:

- `id`;
- `name`;
- `email`;
- `status`;
- `attributes`;
- `version`;
- `created_at`;
- `updated_at`.

`change_log` ინახავს:

- `id`;
- `entity_id`;
- `entity_version`;
- `operation`;
- `payload`;
- `created_at`.

## წარმატების კრიტერიუმები

- [x] Database migration წარმატებით სრულდება;
- [x] `customers` და `change_log` ცხრილები იქმნება;
- [x] Seed ქმნის მითითებული რაოდენობის customer-ს;
- [x] დიდი რაოდენობის მონაცემი batch-ებად მუშავდება;
- [x] `make seed` განმეორებით გაშვებადია;
- [x] შექმნილი ჩანაწერების რაოდენობა SQL query-ით მოწმდება.

## შედეგი

დაემატა PostgreSQL-თან სამუშაო საერთო `DatabaseService`, connection pool და transaction-ის მართვა.

შეიქმნა migration runner, რომელიც შესრულებულ migration-ებს `schema_migrations` ცხრილში ინახავს და ერთსა და იმავე migration-ს მეორედ აღარ უშვებს.

პირველი migration ქმნის:

- `customers` ცხრილს;
- `change_log` ცხრილს;
- საჭირო constraint-ებსა და index-ებს;
- customer-ის version-ის ავტომატურად გასაზრდელ trigger-ს;
- `INSERT`, `UPDATE` და `DELETE` ცვლილებების `change_log`-ში შესანახ trigger-ს.

Docker Compose-ში დაემატა ერთჯერადი `migrate` service. Backend მხოლოდ PostgreSQL-ის healthcheck-ისა და migration-ის წარმატებით დასრულების შემდეგ ეშვება.

Seed მონაცემებს default-ად `5000`-იან batch-ებად წერს. `make seed COUNT=12000` ბრძანებით შემოწმდა სამი batch-ის თანმიმდევრული დამუშავება:

- `5000/12000`;
- `10000/12000`;
- `12000/12000`.

ბაზაში შემოწმებისას შეიქმნა `12000` customer და შესაბამისი `12000` change log ჩანაწერი.

არასწორი `COUNT=0` მნიშვნელობა validation error-ს აბრუნებს და უკვე არსებულ მონაცემებს არ შლის.

## ცვლილებები საწყის გეგმასთან შედარებით

Customer-ის `version` და `change_log` ჩანაწერები application-ის ხელით მართვის ნაცვლად PostgreSQL trigger-ებით იქმნება. ამ გზით ცვლილება და მისი ისტორია ერთი database transaction-ის ფარგლებში ინახება.

Migration-ის გაშვებისთვის Docker Compose-ში ცალკე ერთჯერადი `migrate` service დაემატა.

`make seed` ყოველი გაშვებისას ძველ `customers` და `change_log` მონაცემებს ასუფთავებს, ID-ებს თავიდან იწყებს და ზუსტად მითითებული რაოდენობის სატესტო მონაცემს ქმნის.

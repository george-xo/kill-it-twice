ქვემოთ მოცემული ბლოკის შიგთავსი მთლიანად დააკოპირე `specs/02-project-bootstrap.md` ფაილში:

```md
# PR 02 — პროექტის მომზადება

## დავალება

NestJS backend-ის, Angular frontend-ისა და Docker გარემოს საწყისი სტრუქტურის მომზადება.

## Scope

- NestJS პროექტის შექმნა;
- Angular პროექტის შექმნა;
- backend-ისა და frontend-ის Dockerfile-ები;
- Angular-ის Nginx-ით გაშვება;
- Docker Compose;
- PostgreSQL;
- Elasticsearch;
- RabbitMQ;
- backend-ის `/health` endpoint;
- environment და formatting ფაილები;
- თითოეული service-ის გაშვების შემოწმება.

ამ PR-ში Backfill, Incremental Sync და Gate-ების ლოგიკა არ შედის.

## წარმატების კრიტერიუმები

- [x] Backend წარმატებით იბილდება;
- [x] Frontend წარმატებით იბილდება;
- [x] Docker Compose უშვებს ყველა საჭირო service-ს;
- [x] API-ის `/health` endpoint წარმატებულ პასუხს აბრუნებს;
- [x] ყველა Docker service `healthy` მდგომარეობაშია.

## შედეგი

შეიქმნა NestJS backend და Angular frontend. Angular-ის build ფაილებს Nginx ემსახურება.

Docker Compose ერთი ბრძანებით უშვებს:

- Backend-ს;
- Frontend-ს;
- PostgreSQL-ს;
- Elasticsearch-ს;
- RabbitMQ-ს.

`package-lock.json` ფაილები repository-ში ინახება, რათა ყველა გარემოში dependency-ების ერთნაირი ვერსიები დაყენდეს.

## ცვლილებები საწყის გეგმასთან შედარებით

- Node.js განახლდა 20-დან 24 LTS ვერსიამდე, რადგან გამოყენებული NestJS და Angular tooling Node 20-ს აღარ უჭერდა მხარს.
- Angular-ის production build-ის გასაშვებად დაემატა Nginx.
- Frontend healthcheck-ში `localhost` შეიცვალა `127.0.0.1`-ით, რადგან container-ში თავდაპირველი შემოწმება connection error-ს აბრუნებდა.

## შემოწმება

    npm run build --prefix backend
    npm run build --prefix frontend
    docker compose config --quiet
    docker compose up -d --build
    docker compose ps
```

# PR 12 — Angular Control Panel

## დავალება

Pipeline-ის მონიტორინგისა და მართვისთვის Angular 21 control panel-ის შექმნა.

## Scope

- სისტემის health, workers და pipeline metrics dashboard;
- customer-ების ძებნა, pagination და details;
- Backfill და Incremental Sync start/stop;
- Elasticsearch და RabbitMQ failure simulation;
- customer ცვლილებისა და poison event-ის შექმნა;
- DLQ მდგომარეობის ნახვა და replay;
- frontend-ისა და backend-ის `/api` proxy-ით დაკავშირება.

## წარმატების კრიტერიუმები

- [x] Dashboard აჩვენებს სისტემისა და pipeline-ის მდგომარეობას;
- [x] customer list, search, pagination და details მუშაობს;
- [x] worker-ების მართვა UI-დან მუშაობს;
- [x] failure simulation და recovery მუშაობს;
- [x] DLQ replay UI-დან სრულდება;
- [x] frontend Docker Compose-ით ეშვება;
- [x] G1–G5 verification კვლავ წარმატებით სრულდება.

## შედეგი

დაემატა Angular Material-ზე აგებული control panel, საჭირო backend API-ები და უსაფრთხო simulation controls.

G5 verification-ში გასწორდა Source-სა და Elasticsearch-ს შორის დარჩენილი მონაცემების შეუსაბამობა.

## ცვლილებები საწყის გეგმასთან შედარებით

პერიოდული ავტომატური refresh-ის ნაცვლად გამოყენებულია ხელით განახლება, რათა UI-ის ქცევა მარტივი და პროგნოზირებადი დარჩეს.

Authentication და frontend automated tests ამ ეტაპის scope-ში არ შესულა.

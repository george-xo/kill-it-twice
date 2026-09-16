# PR 13 — Final Checks

## დავალება

პროექტის გაშვებისა და საბოლოო verification პროცესის გამარტივება.

## Scope

- ორივე პროექტის dependencies-ის ერთი ბრძანებით დაყენება;
- Docker environment-ის, migrations-ის, seed-ისა და Backfill-ის ავტომატური მომზადება;
- Frontend-ისა და Backend-ის ერთი ბრძანებით გაშვება;
- G1–G5 verification-ის root და `backend` დირექტორიიდან გაშვება;
- საბოლოო README-ის განახლება.

## წარმატების კრიტერიუმები

- [x] `make install` აყენებს ყველა dependency-ს;
- [x] `make setup` ამზადებს საწყის გარემოს;
- [x] `make start` უშვებს სრულ აპლიკაციას;
- [x] `make verify` ამოწმებს ხუთივე Gate-ს;
- [x] პროექტის გაშვების ინსტრუქცია აღწერილია README-ში.

## შედეგი

პროექტის დაყენება, გაშვება და შემოწმება სრულდება მოკლე Make command-ებით.

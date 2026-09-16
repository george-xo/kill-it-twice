# PR 13 — საბოლოო Checks და Script Validation

## დავალება

პროექტისა და G1–G5 verification scripts-ის საბოლოო შემოწმება.

## Scope

- verification scripts-ის syntax და executable permissions;
- თითოეული gate-ის დამოუკიდებლად გაშვება;
- სრული `make verify` პროცესის შემოწმება;
- Backend build და lint;
- Frontend build და formatting check;
- Docker Compose configuration და clean-start შემოწმება;
- აღმოჩენილი script/configuration პრობლემების გასწორება.

## წარმატების კრიტერიუმები

- [ ] ყველა shell script syntax check-ს გადის;
- [ ] `verify-g1`–`verify-g5` დამოუკიდებლად მუშაობს;
- [ ] `make verify` ხუთივე gate-ს PASS შედეგით ასრულებს;
- [ ] Backend build და lint წარმატებით სრულდება;
- [ ] Frontend build და formatting check წარმატებით სრულდება;
- [ ] Docker Compose სუფთა გარემოდან ეშვება;
- [ ] საბოლოო Git diff-ში შემთხვევითი ან არასაჭირო ფაილები არ რჩება.

## ამ PR-ში არ შედის

- ახალი backend ან frontend feature;
- TypeORM-ზე მიგრაცია;
- UI redesign;
- ახალი application-level automated tests.

## შედეგი

ჯერ არ არის შესრულებული.

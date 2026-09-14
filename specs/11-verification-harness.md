# PR 11 — G1–G5 საბოლოო Verification

## დავალება

ხუთივე Gate-ის ერთიანი და სანდო ავტომატური შემოწმების მომზადება.

## Scope

- G2–G4 scripts-ის structured logs-ზე მორგება;
- G1-ის kill, resume და lost records შემოწმება;
- G2-ის source/sink და duplicate reconciliation;
- G3-ის outage და recovery time;
- G4-ის partial batch და DLQ განაწილება;
- G5-ის metrics, status და logs;
- verification scripts-ის მოწესრიგება;
- ერთიანი `make verify` ანგარიში.

## წარმატების კრიტერიუმები

- [ ] `make verify` ავტომატურად უშვებს G1–G5 ტესტებს;
- [ ] თითო Gate აბრუნებს მკაფიო PASS ან FAIL შედეგს;
- [ ] დაკარგული და დუბლირებული შედეგები ზუსტად ითვლება;
- [ ] outage და recovery ავტომატურად მოწმდება;
- [ ] ნაწილობრივი batch failure და DLQ მოწმდება;
- [ ] ნებისმიერი შეცდომისას ბრძანება non-zero exit code-ს აბრუნებს.

## შედეგი

ჯერ არ არის შესრულებული.

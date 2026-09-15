COUNT ?= 1000

.PHONY: seed verify verify-g1 verify-g2 verify-g3 verify-g4 verify-g5

seed:
	docker compose run --rm -e SEED_COUNT=$(COUNT) backend node dist/seed/seed.js

verify:
	./scripts/verify.sh

verify-g1:
	./scripts/verify-g1.sh

verify-g2:
	./scripts/verify-g2.sh

verify-g3:
	./scripts/verify-g3.sh

verify-g4:
	./scripts/verify-g4.sh

verify-g5:
	./scripts/verify-g5.sh
COUNT ?= 1000

.PHONY: seed verify-g1 verify-g2

seed:
	docker compose run --rm -e SEED_COUNT=$(COUNT) backend node dist/seed/seed.js

verify-g1:
	./scripts/verify-g1.sh

verify-g2:
	./scripts/verify-g2.sh
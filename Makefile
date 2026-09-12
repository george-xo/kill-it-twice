COUNT ?= 1000

.PHONY: seed verify-g1

seed:
	docker compose exec -T -e SEED_COUNT=$(COUNT) backend node dist/seed/seed.js

verify-g1:
	./scripts/verify-g1.sh
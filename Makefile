COUNT ?= 1000

.PHONY: seed

seed:
	docker compose exec -T -e SEED_COUNT=$(COUNT) backend node dist/seed.js
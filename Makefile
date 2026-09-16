COUNT ?= 1000

.PHONY: install setup start stop seed verify verify-g1 verify-g2 verify-g3 verify-g4 verify-g5

install:
	bash ./scripts/install.sh

setup:
	SEED_COUNT=$(COUNT) bash ./scripts/setup.sh

start:
	bash ./scripts/start.sh

stop:
	docker compose down

seed:
	docker compose run --rm -e SEED_COUNT=$(COUNT) backend node dist/seed/seed.js

verify:
	bash ./scripts/verify.sh

verify-g1:
	bash ./scripts/verify-g1.sh

verify-g2:
	bash ./scripts/verify-g2.sh

verify-g3:
	bash ./scripts/verify-g3.sh

verify-g4:
	bash ./scripts/verify-g4.sh

verify-g5:
	bash ./scripts/verify-g5.sh
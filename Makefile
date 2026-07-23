COMPOSE_FILE = docker-compose.yml

# Mandatory targets only — build/run the stack, watch it, tunnel it. No
# secrets-file management (this project's secrets already live in .env,
# read directly by prisma.config.ts / docker-compose.yml), no OAuth checks
# (none of this app's auth is OAuth), no host-wide docker prune (docker
# compose commands are already scoped to this project's containers/images —
# a raw `docker system prune` is not).

.PHONY: all build up down stop logs clean tunnel stop-tunnel re

all: build up

build:
	@docker compose -f $(COMPOSE_FILE) build

up:
	@docker compose -f $(COMPOSE_FILE) up -d
	@echo "web:  http://localhost:3000"
	@echo "logs: make logs"

down:
	@docker compose -f $(COMPOSE_FILE) down

stop:
	@docker compose -f $(COMPOSE_FILE) stop

logs:
	@docker compose -f $(COMPOSE_FILE) logs -f

clean:
	@docker compose -f $(COMPOSE_FILE) down -v --rmi local

# Starts the stack in watch mode — edits under app/, lib/, and
# packages/board-codec/src sync straight into the running web container and
# Next hot-reloads, no rebuild (see docker-compose.yml's develop.watch) —
# then attaches ngrok in the foreground so you watch live tunnel traffic.
# Ctrl+C stops ngrok; watch and the containers keep running underneath
# (`make stop-tunnel` or `make down` to take those down too).
tunnel: up
	@docker compose -f $(COMPOSE_FILE) watch & \
	sleep 2; \
	FOREGROUND=1 bash scripts/start-tunnel.sh

stop-tunnel:
	@bash scripts/stop-tunnel.sh
	@pkill -f "docker compose -f $(COMPOSE_FILE) watch" 2>/dev/null || true
	@echo "watch stopped (containers left running — 'make down' to stop those too)"

re: down up

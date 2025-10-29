#   ┌──────────────────────────────────────────────────────────────────────────┐
#   │ App Commands                                                             │
#   └──────────────────────────────────────────────────────────────────────────┘
up: clean_compose conditional_down
	mkdir -p ./test-results && chown $$(id -u):$$(id -g) ./test-results
	doppler secrets --config dev && \
	doppler run --config dev \
		--mount-template doppler-compose.yml \
		--mount docker-compose.yml \
		--command 'docker-compose up frontend --build'

down: clean_compose
	doppler run --config dev \
		--mount-template doppler-compose.yml \
		--mount docker-compose.yml \
		--command 'docker-compose down'

#   ┌──────────────────────────────────────────────────────────────────────────┐
#   │ Test Commands                                                            │
#   └──────────────────────────────────────────────────────────────────────────┘
test_be: clean_compose conditional_down
	chown $$(id -u):$$(id -g) ./test-results									# Address permissions for test-results
	doppler secrets --config dev_testing && \
	doppler run --config dev_testing \
		--mount-template doppler-compose.yml \
		--mount docker-compose.yml \
		--command 'docker-compose up backend-test --build'

test_fe: clean_compose conditional_down
	doppler secrets --config dev_testing && \
	doppler run --config dev_testing \
		--mount-template doppler-compose.yml \
		--mount docker-compose.yml \
		--command 'docker-compose run --build --rm frontend npm test'

#   ┌──────────────────────────────────────────────────────────────────────────┐
#   │ Conditionals                                                             │
#   └──────────────────────────────────────────────────────────────────────────┘
clean_compose:
	@if [ -e docker-compose.yml ]; then \
		echo "Removing old docker-compose template"; \
		rm -f docker-compose.yml; \
	fi
conditional_down:
	@if [ -n "$$(docker ps -q)" ]; then \
		echo "Stopping running containers..."; \
		docker-compose down || true; \
	else \
		echo "No containers are running."; \
	fi
.PHONY: up down test_be test_fe conditional_down clean_compose

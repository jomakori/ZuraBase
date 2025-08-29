up: conditional_down															# Confirm no containers are running
	mkdir -p ./test-results && chown $$(id -u):$$(id -g) ./test-results
	doppler secrets --config dev && \
	doppler run --config dev \
		--mount-template doppler-compose.yml \
		--mount docker-compose.yml \
		--command 'docker-compose up frontend --build'

down:
	doppler run --config dev \
		--mount-template doppler-compose.yml \
		--mount docker-compose.yml \
		--command 'docker-compose down'

test_be: conditional_down														# Confirm no containers are running
	chown $$(id -u):$$(id -g) ./test-results									# Address permissions for test-results
	doppler secrets --config dev_testing && \
	doppler run --config dev_testing \
		--mount-template doppler-compose.yml \
		--mount docker-compose.yml \
		--command 'docker compose up backend-test --build'

conditional_down:
	@if [ -n "$$(docker ps -q)" ]; then \
		$(MAKE) down; \
	else \
		echo "No containers are running."; \
	fi

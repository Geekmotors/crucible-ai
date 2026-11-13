.PHONY: e2e-core e2e-ext e2e e2e-key e2e-build

E2E_JEST = cd e2e && NODE_OPTIONS="--experimental-vm-modules --use-system-ca" ../node_modules/.bin/jest --config jest.config.mjs --ci

e2e-key:
	@if [ -z "$$OPENROUTER_API_KEY" ]; then \
		echo "e2e: OPENROUTER_API_KEY is not set. e2e runs judge calls against real OpenRouter." >&2; \
		echo "     Export your key first, e.g.: set -a; . ./.env.dev.local; set +a" >&2; \
		exit 2; \
	fi

e2e-build: e2e-key
	npm run build
	npx tsc --noEmit -p e2e

e2e-core: e2e-build
	$(E2E_JEST) --testPathPatterns 'e2e/core/'

e2e-ext: e2e-build
	$(E2E_JEST) --testPathPatterns 'e2e/ext/'

e2e: e2e-core e2e-ext

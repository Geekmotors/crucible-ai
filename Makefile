.PHONY: e2e-core e2e-ext e2e e2e-key e2e-build conformance conformance-image

E2E_NODE_OPTIONS ?= --experimental-vm-modules --use-system-ca
CONFORMANCE_IMAGE ?= crucible-ai-conformance
CONFORMANCE_REPS ?= 3
CONFORMANCE_CA_BUNDLE ?=
MACOS_CA_KEYCHAINS = /Library/Keychains/System.keychain /System/Library/Keychains/SystemRootCertificates.keychain

E2E_JEST = cd e2e && NODE_OPTIONS="$(E2E_NODE_OPTIONS)" ../node_modules/.bin/jest --config jest.config.mjs --ci

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

conformance-image:
	docker build --file e2e/ext/conformance/Dockerfile --tag $(CONFORMANCE_IMAGE) .

conformance: e2e-key conformance-image
	@{ \
		if [ -n "$(CONFORMANCE_CA_BUNDLE)" ]; then cat "$(CONFORMANCE_CA_BUNDLE)"; \
		elif command -v security >/dev/null 2>&1; then security find-certificate -a -p $(MACOS_CA_KEYCHAINS); \
		fi; \
	} | docker run --rm --interactive \
		--env OPENROUTER_API_KEY \
		--env CONFORMANCE_REPS=$(CONFORMANCE_REPS) \
		--env CONFORMANCE_EXTRA_CA=/dev/stdin \
		$(CONFORMANCE_IMAGE)

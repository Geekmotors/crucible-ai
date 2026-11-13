.PHONY: e2e-core e2e-ext e2e e2e-key e2e-build conformance conformance-image

E2E_NODE_OPTIONS ?= --experimental-vm-modules --use-system-ca
CONFORMANCE_IMAGE ?= crucible-ai-conformance
CONFORMANCE_REPS ?= 3
CONFORMANCE_SUITES ?= coherent extract
CONFORMANCE_CA_BUNDLE ?=
CONFORMANCE_CONFIG ?= e2e/crucible.config.json
MACOS_CA_KEYCHAINS = /Library/Keychains/System.keychain /System/Library/Keychains/SystemRootCertificates.keychain

E2E_JEST = cd e2e && NODE_OPTIONS="$(E2E_NODE_OPTIONS)" ../node_modules/.bin/jest --config jest.config.mjs --ci

e2e-key:
	@if [ -z "$$(printf '%s' "$$CRUCIBLE_JUDGE_KEY" | tr -d '[:space:]')" ]; then \
		echo "e2e: CRUCIBLE_JUDGE_KEY is not set. e2e runs judge calls against real OpenRouter; set it to your OpenRouter key." >&2; \
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

CONFORMANCE_RUN = docker run --rm --volume "$(abspath $(CONFORMANCE_CONFIG)):/conformance/judge.config.json:ro"

conformance: conformance-image
	@if [ ! -f "$(CONFORMANCE_CONFIG)" ]; then \
		echo "conformance: judge config $(CONFORMANCE_CONFIG) not found. Set CONFORMANCE_CONFIG to a crucible.config.json." >&2; \
		exit 2; \
	fi
	@key_line=$$($(CONFORMANCE_RUN) $(CONFORMANCE_IMAGE) key-env) || exit $$?; \
	set -- $$key_line; key_env=$$1; key_need=$$2; \
	key_flag=; \
	if [ -n "$$(printenv "$$key_env" | tr -d '[:space:]')" ]; then \
		key_flag="--env $$key_env"; \
	elif [ "$$key_need" = required ]; then \
		echo "conformance: $$key_env is not set. The judge config $(CONFORMANCE_CONFIG) reads its key from it." >&2; \
		echo "     Export your key first, e.g.: set -a; . ./.env.dev.local; set +a" >&2; \
		exit 2; \
	fi; \
	{ \
		if [ -n "$(CONFORMANCE_CA_BUNDLE)" ]; then cat "$(CONFORMANCE_CA_BUNDLE)"; \
		elif command -v security >/dev/null 2>&1; then security find-certificate -a -p $(MACOS_CA_KEYCHAINS); \
		fi; \
	} | $(CONFORMANCE_RUN) --interactive \
		$$key_flag \
		--env CONFORMANCE_REPS=$(CONFORMANCE_REPS) \
		--env CONFORMANCE_SUITES="$(CONFORMANCE_SUITES)" \
		--env CONFORMANCE_EXTRA_CA=/dev/stdin \
		$(CONFORMANCE_IMAGE)

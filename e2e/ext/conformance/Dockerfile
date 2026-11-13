FROM alpine:3.22

RUN apk add --no-cache ca-certificates curl jq

WORKDIR /conformance
COPY schemas/coherent.md schemas/extract.md schemas/
COPY e2e/crucible.config.json judge.config.json
COPY e2e/ext/fixtures/coherent-conformance.json cases/coherent.json
COPY e2e/ext/fixtures/extract-conformance.json cases/extract.json
COPY e2e/ext/conformance/conformance.sh e2e/ext/conformance/payload-sections.jq e2e/ext/conformance/coherent-payload.jq e2e/ext/conformance/extract-payload.jq ./

USER nobody
ENTRYPOINT ["/bin/sh", "/conformance/conformance.sh"]
CMD ["run"]

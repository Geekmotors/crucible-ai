FROM alpine:3.22

RUN apk add --no-cache ca-certificates curl jq

WORKDIR /conformance
COPY schemas/coherent.md schema.md
COPY e2e/crucible.config.json judge.config.json
COPY e2e/ext/fixtures/coherent-conformance.json cases.json
COPY e2e/ext/conformance/conformance.sh e2e/ext/conformance/coherent-payload.jq ./

USER nobody
ENTRYPOINT ["/bin/sh", "/conformance/conformance.sh"]
CMD ["run"]

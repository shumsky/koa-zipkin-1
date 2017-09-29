"use strict";

const zipkin = require('zipkin');
const lib = require('./lib');



module.exports = function koaZipkin(options) {
  const tracer = options.tracer;
  const serviceName = options.serviceName || 'unknown';
  const port = options.port || 0;

  if (!tracer) {
    return function * (next) {
      yield next;
    };
  }

  return function * (next) {
    const req = this.request;
    const res = this.response;

    this.response.set('Access-Control-Allow-Origin', '*');
    this.response.set('Access-Control-Allow-Headers', [
      'Origin', 'Accept', 'X-Requested-With', 'X-B3-TraceId',
      'X-B3-ParentSpanId', 'X-B3-SpanId', 'X-B3-Sampled'
    ].join(', '));

    function readHeader(headerName) {
      const val = lib.getHeaderValue(req, headerName);
      if (val != null) {
        return new zipkin.option.Some(val);
      } else {
        return zipkin.option.None;
      }
    }

    if (lib.containsRequiredHeaders(req)) {
      const spanId = readHeader(zipkin.HttpHeaders.SpanId);
      spanId.ifPresent((sid) => {
        const childId = new zipkin.TraceId({
          traceId: readHeader(zipkin.HttpHeaders.TraceId),
          parentId: readHeader(zipkin.HttpHeaders.ParentSpanId),
          spanId: sid,
          sampled: readHeader(zipkin.HttpHeaders.Sampled).map(lib.stringToBoolean),
          flags: readHeader(zipkin.HttpHeaders.Flags).flatMap(lib.stringToIntOption).getOrElse(0)
        });
        tracer.setId(childId);
      });
    } else {
      const rootId = tracer.createRootId();
      if (lib.getHeaderValue(req, zipkin.HttpHeaders.Flags)) {
        const rootIdWithFlags = new zipkin.TraceId({
          traceId: rootId.traceId,
          parentId: rootId.parentId,
          spanId: rootId.spanId,
          sampled: rootId.sampled,
          flags: readHeader(zipkin.HttpHeaders.Flags)
        });
        tracer.setId(rootIdWithFlags);
      } else {
        tracer.setId(rootId);
      }
    }

    const traceId = tracer.id;

    tracer.scoped(() => {
      tracer.setId(traceId);
      tracer.recordServiceName(serviceName);
      tracer.recordRpc(req.method.toUpperCase());
      tracer.recordBinary('http.url', lib.formatRequestUrl(req));
      tracer.recordAnnotation(new zipkin.Annotation.ServerRecv());
      tracer.recordAnnotation(new zipkin.Annotation.LocalAddr({port}));

      if (traceId.flags !== 0 && traceId.flags != null) {
        tracer.recordBinary(zipkin.HttpHeaders.Flags, traceId.flags.toString());
      }
    });

    this[zipkin.HttpHeaders.TraceId] = traceId;

    yield next;

    tracer.scoped(() => {
      tracer.setId(traceId);
      tracer.recordBinary('http.status_code', res.status.toString());
      tracer.recordAnnotation(new zipkin.Annotation.ServerSend());
    });
  }
};
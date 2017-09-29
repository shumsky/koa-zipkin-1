const zipkin = require('zipkin');
const url = require('url');

function getHeaderValue(req, headerName) {
  return req.header[headerName.toLowerCase()];
}

function containsRequiredHeaders(req) {
  return getHeaderValue(req, zipkin.HttpHeaders.TraceId) !== undefined
      && getHeaderValue(req, zipkin.HttpHeaders.SpanId) !== undefined;
}

function formatRequestUrl(req) {
  const parsed = url.parse(req.originalUrl);
  return url.format({
    protocol: req.protocol,
    host: req.header['host'],
    pathname: parsed.pathname,
    search: parsed.search
  });
}

function stringToBoolean(str) {
  return str === '1';
}

function stringToIntOption(str) {
  try {
    return new zipkin.option.Some(parseInt(str));
  } catch (err) {
    return zipkin.option.None;
  }
}

module.exports = {
  getHeaderValue,
  containsRequiredHeaders,
  formatRequestUrl,
  stringToBoolean,
  stringToIntOption
};






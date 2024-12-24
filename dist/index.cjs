const parse = require('regexparam');

class Router {
  constructor() {
    this.routes = [];

    this.all = this.add.bind(this, "");
    this.get = this.add.bind(this, "GET");
    this.head = this.add.bind(this, "HEAD");
    this.patch = this.add.bind(this, "PATCH");
    this.options = this.add.bind(this, "OPTIONS");
    this.connect = this.add.bind(this, "CONNECT");
    this.delete = this.add.bind(this, "DELETE");
    this.trace = this.add.bind(this, "TRACE");
    this.post = this.add.bind(this, "POST");
    this.put = this.add.bind(this, "PUT");
  }

  use(route, ...fns) {
    let handlers = [].concat.apply([], fns);
    let { keys, pattern } = parse(route, true);
    this.routes.push({ keys, pattern, method: "", handlers });
    console.log(this);
    return this;
  }

  add(method, route, ...fns) {
    let { keys, pattern } = parse(route);
    let handlers = [].concat.apply([], fns);
    this.routes.push({ keys, pattern, method, handlers });
    return this;
  }

  find(method, url) {
    let isHEAD = method === "HEAD";
    let i = 0,
      j = 0,
      k,
      tmp,
      arr = this.routes;
    let mch = [],
      params = {},
      handlers = [];
    for (; i < arr.length; i++) {
      tmp = arr[i];
      if (
        tmp.method.length === 0 ||
        tmp.method === method ||
        (isHEAD && tmp.method === "GET")
      ) {
        if (tmp.keys === false) {
          mch = tmp.pattern.exec(url);
          if (mch === null) continue;
          if (mch.groups !== void 0)
            for (k in mch.groups) params[k] = mch.groups[k];
          tmp.handlers.length > 1
            ? (handlers = handlers.concat(tmp.handlers))
            : handlers.push(tmp.handlers[0]);
        } else if (tmp.keys.length > 0) {
          mch = tmp.pattern.exec(url);
          if (mch === null) continue;
          for (j = 0; j < tmp.keys.length; ) params[tmp.keys[j]] = mch[++j];
          tmp.handlers.length > 1
            ? (handlers = handlers.concat(tmp.handlers))
            : handlers.push(tmp.handlers[0]);
        } else if (tmp.pattern.test(url)) {
          tmp.handlers.length > 1
            ? (handlers = handlers.concat(tmp.handlers))
            : handlers.push(tmp.handlers[0]);
        }
      }
    }

    return { params, handlers };
  }
}


const onerror = (err, req, res) =>
  (res.statusCode = err.status || 500) && res.end(err.message);
const isResSent = (res) => res.finished || res.headersSent || res.writableEnded;
const mount = (fn) => (fn.routes ? fn.handle.bind(fn) : fn);

module.exports = function factory({
  onError = onerror,
  onNoMatch = onerror.bind(null, { status: 404, message: "not found" }),
  attachParams = false,
} = {}) {
  function nr(req, res) {
    return nr.run(req, res).then(
      () => !isResSent(res) && onNoMatch(req, res),
      (err) => onError(err, req, res)
    );
  }
  nr.routes = [];
  const _use = Router.prototype.use.bind(nr);
  const _find = Router.prototype.find.bind(nr);
  const _add = Router.prototype.add.bind(nr);
  function add(method, base, ...fns) {
    if (typeof base !== "string") return add(method, "*", base, ...fns);
    _add(method, base, ...fns);
    return nr;
  }
  nr.use = function use(base, ...fns) {
    if (typeof base !== "string") return this.use("/", base, ...fns);
    if (base !== "/") {
      let addedSlash = false;
      fns.unshift((req, _, next) => {
        req.url = req.url.substring(base.length);
        if ((addedSlash = req.url[0] !== "/")) req.url = "/" + req.url;
        next();
      });
      fns.push(
        (req, _, next) =>
          (req.url = base + (addedSlash ? req.url.substring(1) : req.url)) &&
          next()
      );
    }
    _use(base, ...fns.map(mount));
    return nr;
  };
  nr.all = add.bind(nr, "");
  nr.get = add.bind(nr, "GET");
  nr.head = add.bind(nr, "HEAD");
  nr.post = add.bind(nr, "POST");
  nr.put = add.bind(nr, "PUT");
  nr.delete = add.bind(nr, "DELETE");
  nr.options = add.bind(nr, "OPTIONS");
  nr.trace = add.bind(nr, "TRACE");
  nr.patch = add.bind(nr, "PATCH");
  nr.run = function run(req, res) {
    return new Promise((resolve, reject) => {
      this.handle(req, res, (err) => (err ? reject(err) : resolve()));
    });
  };
  nr.handle = function handle(req, res, done) {
    const idx = req.url.indexOf("?");
    const { handlers, params } = _find(
      req.method,
      idx !== -1 ? req.url.substring(0, idx) : req.url
    );
    if (attachParams) req.params = params;
    let i = 0;
    const len = handlers.length;
    const loop = async (next) => handlers[i++](req, res, next);
    const next = (err) => {
      i < len
        ? err
          ? onError(err, req, res, next)
          : loop(next).catch(next)
        : done && done(err);
    };
    next();
  };
  return nr;
}

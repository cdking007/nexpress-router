# nexpress-router

[![npm](https://badgen.net/npm/v/nexpress-router)](https://www.npmjs.com/package/nexpress-router)
[![minified size](https://badgen.net/bundlephobia/min/nexpress-router)](https://bundlephobia.com/result?p=nexpress-router)
[![download/year](https://badgen.net/npm/dy/nexpress-router)](https://www.npmjs.com/package/nexpress-router)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](CONTRIBUTING.md)

A familiar Express style method router for [Next.js](https://nextjs.org/)

## Features

- Compatible with Express.js middleware and router.
- Works with async handlers (with error catching)
- Lightweight
- TypeScript support

## Installation

```sh
npm install nexpress-router
// or
yarn add nexpress-router
```

## Usage

`nexpress-router` was designed for use with Next.js [API Routes](https://nextjs.org/docs/api-routes/introduction):

```javascript
// pages/api/hello-world.js
import nr from "nexpress-router";

const router = nr()
  .use(middleware())
  .get((req, res) => {
    res.send("Hello, world!");
  })
  .post((req, res) => {
    res.json({ hello: "world!" });
  })
  .put(async (req, res) => {
    res.end("async/await is also supported!");
  })
  .patch(async (req, res) => {
    throw new Error("Errors can be caught and handled.");
  });

export default router;
```

For quick migration from [Custom Express server](https://nextjs.org/docs/advanced-features/custom-server), simply replacing `express()` _and_ `express.Router()` with `nr()` and follow the [match multiple routes recipe](#catch-all).

For usage in pages with [`getServerSideProps`](https://nextjs.org/docs/basic-features/data-fetching#getserversideprops-server-side-rendering), see [`.run`](#runreq-res).

### TypeScript

By default, the base interfaces of `req` and `res` are `IncomingMessage` and `ServerResponse`. When using in API Routes, you would set them to `NextApiRequest` and `NextApiResponse` by providing the generics to the factory function like so:

```typescript
import { NextApiRequest, NextApiResponse } from "next";
import nr from "nexpress-router";

const router = nr<NextApiRequest, NextApiResponse>();
```

You can also define custom properties to `req` and `res` (such as `req.user` or `res.cookie`) like so:

```typescript
interface ExtendedRequest {
  user: string;
}
interface ExtendedResponse {
  cookie(name: string, value: string): void;
}

handler.post<ExtendedRequest, ExtendedResponse>((req, res) => {
  req.user = "Picard";
  res.cookie("sid", "8108");
});
```

## API

The API is very similar to [Express.js](https://github.com/expressjs/express), but with some differences:

- It does not include any [helper methods](http://expressjs.com/en/4x/api.html#res.append) or template engine (you can incorporate them using middleware).
- It does not support error-handling middleware pattern. Use `options.onError` instead.

### nr(options)

Initialize an instance of `nexpress-router`.

#### options.onError

Accepts a function as a catch-all error handler; executed whenever a middleware throws an error.
By default, it responds with status code `500` and an error message if any.

```typescript
type ErrorHandler<Req, Res> = (
  err: any,
  req: Req,
  res: Res,
  next: NextHandler // (err?: any) => void;
) => any | Promise<any>;
```

```javascript
function onError(err, req, res, next) {
  logger.log(err);

  res.status(500).end(err.toString());
  // OR continue...
  next();
}

const router = nr({ onError });

router
  .use((req, res, next) => {
    throw new Error("Error occured!!");
    // or use next
    next(Error("Error occured!!"));
  })
  .use((req, res) => {
    // this will run if next() is called in onError
    res.end("no more error.");
  });
```

#### options.onNoMatch

Accepts a function of `(req, res)` as a handler when no route is matched.
By default, it responds with `404` status and `not found` body.

```javascript
function onNoMatch(req, res) {
  res.status(404).end("page is not found..!");
}

const router = nr({ onNoMatch });
```

#### options.attachParams

Passing `true` will attach `params` object to `req`. By default does not set to `req.params`.

```javascript
const router = nr({ attachParams: true });

router.get("/users/:userId/posts/:postId", (req, res) => {
  // Visiting '/users/1/posts/14' will render '{"userId":"1","postId":"14"}'
  res.send(req.params);
});
```

### .use(base, ...fn)

`base` (optional) - match all route to the right of `base` or match all if omitted.

`fn`(s) are functions of `(req, res[, next])` **or** an instance of `nexpress-router`, where it will act as a sub application.

```javascript
// Mount a middleware function
router.use((req, res, next) => {
  req.hello = "world!";
  next();
});

// Or include a base
router.use("/foo", fn); // Only run in /bar/**

// Mount an instance of nexpress-router
const common = nr().use(middleware1).use("/", middleware2);
const auth = nr().use("/home", authStuff);
const subapp = nr().get(getHandle).post("/bar", postHandle).put("/", putHandle);
router
  // `middleware1` and `middleware2` run everywhere
  .use(common)
  // `authStuff` ONLY runs on /home/*
  .use(auth)
  // `getHandle` runs on /foo/*
  // `postHandle` runs on /foo/bar
  // `putHandle` runs on /foo
  .use("/foo", subapp);

// You can use libraries aswell.
router.use(passport.initialize());
```

### .METHOD(pattern, ...fns)

`METHOD` is an HTTP method (`GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `TRACE`) in lowercase.

`pattern` (optional) - match all route based on supported pattern or match all if omitted.

`fn`(s) are functions of `(req, res[, next])`.

```javascript
router.get("/api/user", (req, res, next) => {
  res.json(req.user);
});
router.post("/api/add-user", (req, res, next) => {
  res.end("User created");
});
router.put("/api/user/:id", (req, res, next) => {
  // https://nextjs.org/docs/routing/dynamic-routes
  res.end(`User ${req.query.id} updated`);
});
router.get((req, res, next) => {
  res.end("This matches whatever route");
});
```

### .all(pattern, ...fns)

Same as [.METHOD](#methodpattern-fns) but accepts _any_ methods.

### .run(req, res)

Runs `req` and `res` the middleware and returns a **promise**. It will **not** render `404` on not found or `onError` on error.

This can be useful in [`getServerSideProps`](https://nextjs.org/docs/basic-features/data-fetching#getserversideprops-server-side-rendering).

```javascript
// page/index.js
export async function getServerSideProps({ req, res }) {
  const handler = nr().use(passport.initialize()).post(middleware);
  try {
    await handler.run(req, res);
  } catch (e) {
    // handle error
  }
  // do something with the new/upgraded req and res
  return {
    props: { user: req.user },
  };
}
```

## More Goodies

### Next.js

<details id="catch-all">
<summary>Match multiple routes</summary>

If you created the file `/api/<specific-route>.js` folder, the handler will only run on that specific route.

If you need to create all handlers for all routes in one file (similar to `Express.js`). You can use [Optional catch all API routes](https://nextjs.org/docs/api-routes/dynamic-api-routes#optional-catch-all-api-routes).

```js
// pages/api/[[...slug]].js
import nr from "nexpress-router";

const router = nr({ attachParams: true })
  .use("/api/hello", middleware())
  .get("/api/user/:userId", (req, res) => {
    res.send(`Hello ${req.params.userId}`);
  });

export default router;
```

While this allows quick migration from Express.js, it may be best to split routes into different files (`/api/user/[userId].js`, `/api/hello.js`) in the future.

</details>

### Using in other frameworks

`nexpress-router` supports any frameworks and runtimes that support `(req, res) => void` handler.

<details>
<summary><a href="https://github.com/zeit/micro">Micro</a></summary>

```javascript
const { send } = require("micro");
const nr = require("nexpress-router");

module.exports = nr()
  .use(middleware)
  .get((req, res) => {
    res.end("Hello, world!");
  })
  .post((req, res) => {
    send(res, 200, { hello: "world!" });
  });
```

</details>

<details>
<summary><a href="https://vercel.com/docs/serverless-functions/introduction">Vercel</a></summary>

```javascript
const nr = require("nexpress-router");

module.exports = nr()
  .use(middleware)
  .get((req, res) => {
    res.send("Hello, world!");
  })
  .post((req, res) => {
    res.json({ hello: "world" });
  });
```

</details>

<details>
<summary>Node.js <a href="https://nodejs.org/api/http.html">HTTP</a> / <a href="https://nodejs.org/api/http2.html">HTTP2</a> Server</summary>

```javascript
const http = require("http");
const nr = require("nexpress-router");

const router = nr()
  .use(middleware)
  .get((req, res) => {
    res.end("Hello, world!");
  })
  .post((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ hello: "world" }));
  });

http.createServer(router).listen(PORT);
```

</details>

## Contributing

Please see [contributing.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

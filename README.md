# Hull Connectors
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fhull%2Fhull-connectors.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fhull%2Fhull-connectors?ref=badge_shield)


This is a monorepository containing all official Hull connectors
and supporting libraries.

## Setup overview

The repository is configured using `yarn workspaces` feature.

Root of the repository contains:

- workspaces definition in package.json
- linting configuration and dependencies
- building/transpilation configuration and dependencies
- flow types configuration and dependencies
- jest configuration and dependencies
- common production dependencies

Then separate packages are defined here:

- `pacakges/connectors/*/package.json` - connectors
- `packages/*/package.json` - supporting libraries


**How repository is built/linted/flow tested?**

There is one configuration in the root of repository, the whole project is linted, flow tested and built as one package.
Everything from `packages/*` directory is transpiled into
`dist/*` with the very same structure.
After babeljs build rest of the files such as assets are copied into the `dist`.

**How packages are tested?**

Linting and flow testing is global (look above).
Tests are done in two different ways:

- new tests are using `jest` framework and it's run globally across whole repository
- some of packages are still using `mocha`, so when performing tests, yarn is getting into every package/workspace and run `test` script


## How to migrate a hull-foo connector to the monorepo?

1. copy the code into `pacakges/connectors/hull-foo`
2. make sure that the `name` in package.json is `hull-foo` (some steps depends on it)
3. remove all unnecessary dev and prod dependencies from `package.json` (look at root package.json to see what can be removed)
4. remove all unnecessary npm/yarn scripts for linting and building
5. plug in testing:
  - if tests are written with `mocha`, keep `test` script which runs the mocha tests, but include a special `babel` js file to make sure transpilation is applied: `mocha --require ../../root-babel-register`
  - if tests are written in new `jest` framework go to `jest.config.js` file and add your connector paths
6. make sure that links to hull packages are local:
  ```
  "hull": "link:../../hull",
  "hull-connector-framework": "link:../../hull-connector-framework",
  ```
7. remove all unnecessary configuration files: `.eslintrc`, `.babelrc`, `.editorconfig` etc.


**How to start connector in dev mode?**

First copy the env file and fill it in:
`cp packages/connectors/hull-foo/.env-sample .env.hull-foo`

Then you can start it with the `yarn dev` script:
`dotenv -e .env.hull-foo yarn dev hull-foo`

**How to start a connector and expose it through ngrok**

Start the connector with `yarn combined hull-foo`

**How to start connector in production mode?**

First build the production dist:
`yarn build`

Then given you have the env file in place (if not look above), you can use bash script to run:
`dotenv -e .env.hull-foo bash scripts/start-connector.sh hull-foo`


**How to test single connector?**

Run `jest packages/connectors/hull-foo` if the connector is already on jest.

If on mocha run `yarn workspace hull-foo run test`.

**How to run a test watcher for Mocha tests**

Run `yarn watch:test path_to_tests/*.js`

Tests will run on each file change

**How to lint single connector?**

Run `eslint packages/connectors/hull-foo`

**How to install node-rdkafka package on MacOS?**

https://github.com/Blizzard/node-rdkafka#mac-os-high-sierra--mojave

OpenSSL has been upgraded in High Sierra and homebrew does not overwrite default system libraries. That means when building node-rdkafka, because you are using openssl, you need to tell the linker where to find it:

```
export CPPFLAGS=-I/usr/local/opt/openssl/include
export LDFLAGS=-L/usr/local/opt/openssl/lib
```

Then you can run yarn install to get it to build correctly.

**Installing node-rdkafka on catalina**
If your `yarn install` fails, as per https://github.com/schnerd/d3-scale-cluster/issues/7, you need to reinstall command line tools from time to time

```
sudo rm -rf $(xcode-select -print-path)
xcode-select --install
```


**Run the connector locally using Docker**

Build the image
```
docker build -t connectors .
```

Run the container
```
docker run -p 8082:8082 --env-file ./.env connectors:latest
```

Environment variables needed
```
CLIENT_ID=
CLIENT_SECRET=
FIREHOSE_KAFKA_BROKERS=
FIREHOSE_KAFKA_TOPIC=
FIREHOSE_KAFKA_TOPICS_MAPPING=
LOGGER_KAFKA_BROKERS=
LOGGER_KAFKA_TOPIC=
NODE_ENV=
LOG_LEVEL=
REDIS_URL=
SECRET=
CONNECTOR=
```


**How do I test the kafka firehose transport locally?**

The docker-compose.yml setup comes with a full setup to start a local Kafka broker.
The easiest way to debug locally is to use a tool like kafkacat to tail the messages as they arrive in the destination topic.

Set the connector environment variables related to Kafka:
```
FIREHOSE_KAFKA_BROKERS=localhost:9092
FIREHOSE_KAFKA_TOPIC=local-firehose-connectors

LOGGER_KAFKA_BROKERS=localhost:9092
LOGGER_KAFKA_TOPIC=local-logs-connectors
```

Install kafkacat
```
brew install kafkacat
```

Run the docker containers
```
docker-compose up
```

View the kafka topics. Ensure those listed are `local-firehose-connectors` and `local-logs-connectors`
```
kafkacat -L -b localhost:9092
```

Tail the firehose logs
```
kafkacat -b localhost:9092 -t local-firehose-connectors
```

Tail the connector logs
```
kafkacat -b localhost:9092 -t local-logs-connectors
```
## Client-side code


**How to build client packages**

Client assets will be built during the `build` phase that's triggered when calling `yarn build`. If you want to manually build a single client package, checkout the section below.

**How to build a single client package**

To build the client files for a package, using Webpack, first ensure your files to be built are in the `/src` folder at the root of the package. (For instance `hull-google-analytics/src`)

Then, run `yarn build:client hull-google-analytics`

The files will be built in the `hull-google-analytics/assets` folder

**How to serve javascript compiled files in Development**

The simplest way is to have your connector rely on `packages/server/server`,
and pass `devMode` to `true` -> The connector will automatically pass the files in `/src` through webpack

## Receiving data from Hull in Development

The easiest way to get a connector to receive data from Hull is to start it locally and expose it using a public URL and enter this URL in the `new connector` URL box in your Hull dashboard.

To make this easier, call `yarn ngrok xxx`. For instance, to expose the `hull-typeform` connector, call `yarn ngrok hull-typeform`. Ngrok will start and expose the `https://hull-typeform.ngrok.io` URL to the web (Assuming your Ngrok credentials are configured already, See https://ngrok.com/docs#authtoken)

**Note** You must also boot your connector using `yarn dev hull-typeform` - the `yarn ngrok` command is not doing this for you.

## Changes

Monorepository has one global version and changelog.


## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fhull%2Fhull-connectors.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fhull%2Fhull-connectors?ref=badge_large)
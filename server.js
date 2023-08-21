const express = require('express');
const http = require('http');
const path = require('path');
const { readFileSync } = require('node:fs');
const { checkSchema, validationResult } = require('express-validator');
const { createTerminus } = require('@godaddy/terminus');
const bodyParser = require('body-parser');
const { duplicateRepoAndCreatePR } = require('interview-pr');
const multer = require('multer');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer();

console.log(
  process.env.INVITE_PASSWORD,
  process.env.INVITE_GITHUB_USERNAME,
  process.env.INVITE_GITHUB_TOKEN,
);

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post(
  '/invite',
  upload.none(),
  checkSchema({
    username: {
      errorMessage: 'Будь ласка введіть логін куратора на GitHub',
      notEmpty: true,
      optional: false,
      trim: true,
      in: ['body'],
    },
    password: {
      errorMessage: 'Будь ласка введіть пароль, щоб ми знали, що ви маєте право запрошувати',
      notEmpty: true,
      optional: false,
      trim: true,
      in: ['body'],
      custom: {
        options: (value) => {
          console.log('value: ', value, process.env.INVITE_PASSWORD);
          return value === process.env.INVITE_PASSWORD
        },
        bail: true,
        errorMessage: 'Пароль невірний'
      },
    },
  }),
  async function (req, res) {
    const validation = validationResult(req);
    if (validation.errors.length !== 0) {
      res.status(400).json(validation.errors).end();
      return;
    }
    const filePath = path.join(__dirname, './node_modules/interview-pr', './description.md');
    const PRDesc = readFileSync(filePath, 'utf8');

    try {
      const result = await duplicateRepoAndCreatePR({
        username: process.env.INVITE_GITHUB_USERNAME,
        token: process.env.INVITE_GITHUB_TOKEN,
        curator: req.body.username,
        owner: 'prjctr-react',
        source: 'curator',
        target: `curator-${req.body.username}`,
        from: '3-state',
        to: 'main',
        localPathToRepo: __dirname,
        PRTitle: '3-state',
        PRDesc,
      });
      console.log(result);
      console.log(result?.stdout?.toString());
      console.log(result?.stderr?.toString());
    } catch (error) {
      console.log(error);
      console.log(error?.stdout?.toString());

      console.log(error?.data);
      if (error?.stderr !== undefined) {
        console.log(error?.stderr?.toString());
        res.status(400).json([
          {
            "msg": error?.stderr?.toString(),
            "path": "password",
          }
        ]).end();
      }
      if (error?.response !== undefined) {
        console.log(error.response.data);
        res.status(400).json(error?.response.data.errors).end();
      }
    }
    res.status(204).end();
  });

function beforeShutdown() {
  return new Promise(resolve => {
    setTimeout(resolve, 3000)
  })
}

function healthCheck({ state }) {
  return Promise.resolve()
}

const server = http.createServer(app);
createTerminus(server, {
  healthChecks: {
    '/healthcheck': healthCheck,    // a function accepting a state and returning a promise indicating service health,
    verbatim: true,                 // [optional = false] use object returned from /healthcheck verbatim in response,
    __unsafeExposeStackTraces: true // [optional = false] return stack traces in error response if healthchecks throw errors
  },
  useExit0: true,
  beforeShutdown,
  caseInsensitive: true,                  // [optional] whether given health checks routes are case insensitive (defaults to false)
});

server.listen(PORT);

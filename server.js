const express = require('express');
const http = require('http');
const path = require('path');
const { readFileSync, existsSync } = require('node:fs');
const { checkSchema, validationResult } = require('express-validator');
const { createTerminus } = require('@godaddy/terminus');
const bodyParser = require('body-parser');
const { duplicateRepoAndCreatePR, duplicateRepo } = require('interview-pr');
const multer = require('multer');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer();

const courseFunctionMap = new Map();
courseFunctionMap.set('webapp', async (options) => {
  const taskRepo = duplicateRepo(options);
  const codeReviewRepoSource = `curator-code-review`;
  const codeReviewRepoTarget = `${codeReviewRepoSource}-${options.curator}`;
  const codeReviewRepo = duplicateRepoAndCreatePR({
    ...options,
    source: codeReviewRepoSource,
    target: codeReviewRepoTarget,
    from: 'homework',
  });
  return Promise.all([taskRepo, codeReviewRepo]);
});
courseFunctionMap.set('react', async (options) => {
  return duplicateRepoAndCreatePR({
    ...options,
    from: '3-state',
  })
});

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
    course: {
      isIn: {
        options: [['html-css', 'javascript', 'webapp', 'react']],
        errorMessage: `Курс має бути 'html-css', 'javascript', 'webapp' чи 'react'`,
      },
      errorMessage: 'Потрібно обрати назву курсу',
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

    const course = req.body.course;
    const filePath = path.join(__dirname, `./node_modules/interview-pr/descriptions`, `./${course}.md`);
    const hasDescription = existsSync(filePath);
    const PRDesc = hasDescription ? readFileSync(filePath, 'utf8') : '';
    const options = {
      username: process.env.INVITE_GITHUB_USERNAME,
      token: process.env.INVITE_GITHUB_TOKEN,
      curator: req.body.username,
      owner: `prjctr-${course}`,
      source: 'curator',
      target: `curator-${req.body.username}`,
      to: 'main',
      localPathToRepo: __dirname,
      PRTitle: 'Домашня робота',
      PRDesc,
    };
    const cloner = courseFunctionMap.get(course);
    if (cloner === undefined) {
      throw new Error(`No curator test task for "${course}" course implemented`);
    }
    try {
      const result = await cloner(options);
      res.status(200).json(result).end();
    } catch (error) {
      console.log(error);
      console.log(error?.stdout.toString());
      console.log(error?.data);
      if (error?.stderr !== undefined) {
        console.log(error?.stderr.toString());
        res.status(400).json([
          {
            "msg": error?.stderr.toString(),
            "path": "password",
          }
        ]).end();
      }
      if (error?.response !== undefined) {
        console.log(error.response.data);
        res.status(400).json(error?.response.data.errors).end();
      }
    }

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

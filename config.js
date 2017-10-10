const config = require('nconf');

const architectConfig = [
  {
    "packagePath": "shady-sequelize",
    "host": config.get('mysql:host'),
    "database": config.get('mysql:database'),
    "username": config.get('mysql:username'),
    "password": config.get('mysql:password'),
    "dialect": "mysql"
  },
  {
    "packagePath": "architect-logger",
    "exitOnError": false,
    "transports": {
      "console": {
        "colorize": true,
        "level": "verbose"
      }
    }
  },
  "./plugins/models",
  "./plugins/routes",
  "./plugins/tasks",
  "./plugins/apiclient",
  "./plugins/search"
];

if (!config.get('standalone')) {
  architectConfig.unshift({
    "packagePath": "shady-messages",
    "amqpUrl": config.get('amqp:url')
  }, "shady-worker");
}

module.exports = architectConfig;
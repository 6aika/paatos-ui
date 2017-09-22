const config = require('nconf');

module.exports = [
  {
    "packagePath": "shady-messages",
    "amqpUrl": config.get('amqp:url')
  },
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
   "shady-worker",
  "./plugins/models",
  "./plugins/routes",
  "./plugins/tasks",
  "./plugins/apiclient",
  "./plugins/search"
];
const config = require('nconf');

module.exports = [
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
  "./plugins/routes"
];
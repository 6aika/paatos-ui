# Paatos-ui
Web user interface for paatos-api

# Setup
These instructions assume that system is being installed on machine with Ubuntu 16.04 OS.

### prerequisites
#### Install and configure Mysql / Mariadb server

```
sudo apt-get update
sudo apt-get install mariadb-server mariadb-client
```
Secure your newly installed database (optional but recommended)
```
sudo mysql_secure_installation
```
Create database and database user
```
sudo mysql -u root -p
create database paatosui default character set = utf8mb4 collate = utf8mb4_unicode_ci;
create user 'paatosuser'@'localhost' IDENTIFIED BY 'yourpassword';
grant all privileges on paatosui.* to paatosuser@localhost identified by 'yourpassword';
```
#### Install Elasticsearch

[https://www.elastic.co/guide/en/elasticsearch/reference/current/install-elasticsearch.html](https://www.elastic.co/guide/en/elasticsearch/reference/current/install-elasticsearch.html)

#### Install NodeJS

[https://nodejs.org/en/download/package-manager/](https://nodejs.org/en/download/package-manager/)

### Installation

Paatos-ui can be installed either using latest published version from NPM package manager or by cloning this repository.
#### Using NPM package manager
```
npm install paatos-ui
```
When using NPM your installation base will be node_modules/paatos-ui

#### Using git
clone the repository
```
git clone git@github.com:6aika/paatos-ui.git
```

install dependencies
```
cd paatos-ui
npm install
```

build client scripts and styles
```
npm install -g grunt
grunt
```
### Configuration
Go to your installation base directory, either node_modules/paatos-ui or the repository base directory.

create file named config.json with following content
```
{
  "apis": {
    "espoo": {
      "name": "Espoo",
      "url": "https://paatos-espoo.6aika.fi/v1"      
    },
    "vantaa": {
      "name": "Vantaa",
      "url": "https://paatos-vantaa.6aika.fi/v1"      
    },
    "oulu": {
      "name": "Oulu",
      "url": "https://paatos-oulu.6aika.fi/v1"
    },
    "helsinki": {
      "name": "Helsinki",
      "url": "https://paatos-helsinki.6aika.fi/v1"      
    },
    "tampere": {
      "name": "Tampere",
      "url": "https://paatos-tampere.6aika.fi/v1"      
    }
  },
  "geocode": {
    "url": "http://open.mapquestapi.com/geocoding/v1/address",
    "key": "your-mapquest-api-key"
  },
  "session-secret": "yoursecret",
  "mysql": {
    "host": "localhost",
    "database": "paatosui",
    "username": "paatosuser",
    "password": "yourpassword",
    "port": 3306
  },
  "elasticsearch": {
      "index": "paatosui",
      "log": "debug",
      "hosts": [{ "host": "localhost", "port": 9200 }]
  },
  "tasks": {
    "concurrent": 4,
    "afterProcessDelay": 1000
  }
}
```
"apis": used to configure which paatos-api instances are used for searching the data.

"geocode": connection details to geocoding API.

"session-secret": random string here.

"mysql": database connection details.

"elasticsearch": elastisearch connection details.

"tasks": used to configure how many actions will be indexed simultaneously and how long the system will wait before starting the next indexing batch.

### Running
Start the Paatos-ui by running command
```
node app.js --host localhost --port 8080
```

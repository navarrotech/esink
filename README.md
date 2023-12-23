# Esink
This is an Event Sync microservice designed to publish events from a database and provide a publishable API.

This service is designed to work with either PostgreSQL or MySQL databases. It allows for real-time event publishing to connected clients using socket.io based on changes in the database. This is particularly useful for applications that require immediate updates, like live dashboards, real-time analytics, or collaborative tools.

## Table of Contents
- [Installation](#installation)
- [Configuration](#environment-variables)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)


### Environment variables
Before running esink, you need to configure the database connection and other settings.


- **PORT** - Server port -  Default value is 80
- **NODE_ENV** - Enable Node.js production-specific features w/ flag. - Set to "production" in production - Defaults to "development"
- **USE_SSL** - Setting this to anything will require SSL, while set the server will be unreachable on http - Defaults to false
- **DEFAULT_SOURCE** - When publishing events, the source is "database" or "api." If you make an API call to manually trigger an event to socket.io clients, but don't specify a "source" value in the payload, this default source will be used. - Defaults to "API"
- **ALLOW_REPUBLISHING** - Allows socket.io clients to trigger a publish() event themselves by sending a specific message up to the esink service. Good for testing. - Default false
- **SECURITY_TOKEN** - Required for API usage. When using the API to manually trigger an event, the SECURITY_TOKEN verifies that you are who you say you are. Kind of like a webhook secret. - Defaults to null, and will disable the API routes if null.
- **POSTGRES_DATABASE_URL** - If you want to use PostgreSQL instead of MySQL, just insert your PostgreSQL DATABASE_URL here.
- **MYSQL_DATABASE** - If set, will use MySQL instead of PostgreSQL
- **MYSQL_HOST**
- **MYSQL_PORT**
- **MYSQL_USERNAME** 
- **MYSQL_PASSWORD**
- **MYSQL_TABLE_TARGET** - Name of the MySQL table that triggers will dump events into, the service will poll this table x4 times per second and constantly drop/recreate it upon restarting.
- **TABLE_NAMES** - Applies to both MySQL and PostgreSQL. A string of comma separated table names that you want to have monitored. For example "users,table_2,pushNotifications"
- **AUTH_TABLE** - The table that your auth token lives in. 
- **AUTH_COLUMN** - The column linked to the table in AUTH_TABLE, that your auth token lives in. Can be a JWT, session security token, etc.
- **FILTERS** - A comma separated string of table.column values to remove before publishing to the browser. For example: "user.password,user.reset_password_token,table_name.column_name"
- **TABLE_AUTH_COLUMN_ROUTING** - Stringified JSON that defines auth rules. See below.

**TABLE_AUTH_COLUMN_ROUTING**

This stringified object is used to compare the user.id to a column value, which determines if a user has access to the data emitted from that table.

This is a security measure, to make sure that one user doesn't get another user's stuff by accident.

Psuedo-Code: `IF [user.id] === [table.columnNameFromRouting] THEN ALLOW ACCESS`

If the value is an array, then it will check each column in the given array

If the value is `*`, then it will emit the event to EVERYONE, regardless of user id.

```
{
    // Mapping: "TABLE_NAME": "COLUMN_NAME",
    
    // When the "users" table updates, all socket.io subscriber's who's user.id matches id will get sent the updated payload:
    // Example: My user id is 101, and the users table updated for users 99, 100, and 101. I will only get 101's payload sent to me.
    "users": "id",
    
    // When the "games" table updates, all socket.io subscriber's who's user.id matches hostUserId will get sent the updated payload: 
    "games": "hostUserId",
    
    // When the "pushNotifications" table updates, all socket.io subscriber's who's user.id matches 
    // EITHER userId OR senderID OR recipientID will get sent the updated payload (will send out 3 payloads)
    "pushNotifications": [
    	"userID",
        "senderID",
        "recipientID"
    ],
    
    // Will get sent to every single user currently subscribed to socket.io, regardless of id:
    "targetStatuses": '*',
    
    // When the "usersXtargets" table updates, all socket.io subscriber's who's user.id matches userID will get sent the updated payload: 
    "usersXtargets": "userID",
}
```

See an example environment setup in the docker-compose script below.


## API
**POST** `"/publish"` (Accepts 'application/json')

**POST body**:
```
{
	// Required values:
    data: {
    	<any json data is allowed here>
    }
    type: 'insert' | 'delete' | 'update'
    securityToken: string (must match the environment variable SECURITY_TOKEN exactly)
    userId: string
    table: string
    
    // Optional values:
    timestamp: number (optional, defaults to a javascript timestamp number generated upon publishing)
    source: string (optional, defaults to environment variable DEFAULT_SOURCE)
    version: number (optional, defaults to 1)
}
```

**Status response codes**:
- 200 - Created and sent to socket.io
- 400 - Invalid parameters provided
- 401 - Invalid security token
- 403 - Security token doesn't exist in the environment variables
- 500 - Internal server error

**GET** `"/ping"`
Will always return "pong" as plain text, always 200 status if online.


### Installation
To install esink, follow these steps:

1. Clone the repository: `git clone https://github.com/navarrocity/esink.git`
2. Navigate to the project directory: `cd esink`
3. Install dependencies: `yarn install`

## Usage
Ideally you should run this in a docker container. If you want to run it locally, you can start the esink microservice by running the following command:

`yarn run start`

To run in development mode, where Node.js will watch for changes & restart your code automatically, run:

`yarn run dev`


**Sample docker-compose script (recommended)**
```
  esink:
    image: navarrocity/esink-service:latest
    container_name: esink
    restart: unless-stopped
    environment:
      # Node server settings
      - NODE_ENV=production
      - USE_SSL=true
      - PORT=80
      # Preferences
      - ALLOW_REPUBLISHING=false
      - DEFAULT_SOURCE='api'
      - MYSQL_TABLE_TARGET='esink_pubsub'
      - TABLE_NAMES='users,transactions,bankRecords,table_name_4'
      - TABLE_AUTH_COLUMN_ROUTING=${TABLE_AUTH_COLUMN_ROUTING}
      # Security
      - SECURITY_TOKEN=${ESINK_SECURITY_TOKEN}
      # Database
      - MYSQL_DATABASE=${MYSQL_DATABASE}
      - MYSQL_USERNAME=${MYSQL_USER}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
      - MYSQL_HOST=${MYSQL_HOST}
      - MYSQL_PORT=${MYSQL_PORT}
    ports:
      - 80:80
    networks:
      - default
```

## Socket.io Information
In order to connect from the frontend, you'll need to use the esink domain host (no url pathname required), and you must pass along a token as a query:
```
const socket = io('http://localhost/', {
  auth: {
  	token: 'TEST'
  }
});
```
Note: Leaving token as `"TEST"` will actually work but it will return sample data, with a user id of `-1`.

```
// The "connected" topic will fire one event when you are first connected, if you are successfully connected.
socket.on('connected', (socket) => {
  // Your regular socket.io code
  console.log(socket)
});

// If you're unauthorized, this error will trigger.
// Will also trigger if you send invalid parameters while trying to self publish.
socket.on('error', callback);

// Every time an event is emitted with changes data, two topics are fired.
// A dedicated tableName event is emitted and a generic "changes" is emitted.
socket.on(tableName, callback);
socket.on('changes', callback);

// If you want to subscribe to only one table's changes:
socket.on(tableName, callback);

// If you want to subscribe to all changes:
socket.on('changes', callback);
```

## How esink works under the hood


**PostgreSQL**

For PostgreSQL, this service utilizes the native LISTEN and NOTIFY functionality. Triggers are set up on specified tables, and any INSERT, UPDATE, or DELETE operation on these tables will result in a PostgreSQL NOTIFY event. This event is then captured by the service and relayed to the connected socket.io clients.

**MySQL**

Since MySQL does not have a native LISTEN and NOTIFY mechanism, the service implements a polling mechanism. This involves periodically checking (polling) a special table for new events. Triggers on the target tables insert event records into this table, which includes information about the operation type (INSERT, UPDATE, DELETE), the affected data, and the table name.

The service polls the database at a maximum frequency of 4 times per second to balance between real-time updates and database performance.

The service checks for new rows in the event table.
If new rows are found, it processes each row and determines the type of event and the affected table.
The service then constructs a payload with this information.
Finally, the payload is published to socket.io clients using the publish() function.

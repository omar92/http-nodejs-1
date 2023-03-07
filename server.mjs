// import { createServer } from 'http';

// createServer((req, res) => {
//   res.write('Hello World!');
//   res.end();
// }).listen(process.env.PORT);
// Requiring module
import express from 'express';
import WebSocket from 'ws';

// Creating express object
const app = express();

const servers = {
  prod1: { protocol: "wss", host: "photon-prod-1.highstreet.market", port: "443" },// http://127.0.0.1:5000/test/prod1
  prod2: { protocol: "wss", host: "photon-prod-2.highstreet.market", port: "443" },// http://127.0.0.1:5000/test/prod2
  dev1: { protocol: "wss", host: "photon-dev-1.highstreet.market", port: "443" },  // http://127.0.0.1:5000/test/dev1
  dev2: { protocol: "wss", host: "photon-dev-2.highstreet.market", port: "443" },  // http://127.0.0.1:5000/test/dev2
  local8887: { protocol: "ws", host: "127.0.0.1", port: "8887" },  // http://127.0.0.1:5000/test/local8887
  local8888: { protocol: "ws", host: "127.0.0.1", port: "8888" },  // http://127.0.0.1:5000/test/local8888
  local8889: { protocol: "ws", host: "127.0.0.1", port: "8889" },  // http://127.0.0.1:5000/test/local8889
}

var clients = [];
var gradualInterval = null;

// Handling GET request
app.get('/', (req, res) => {
  sendStatistics(res,true);
})

app.get('/test/:serverName/sendRate', (req, res) => {
  //sample GET request at 'test/dev1/100'
  var _name = req.params.serverName;
  var server = servers[_name];
  var _protocol = server.protocol;
  var _host = server.host;
  var _port = server.port;
  var _sendRate = req.query.sendRate;
  starNewClient(_host, _port, _sendRate, _protocol, res);
  sendStatistics(res);
})
app.get('/test/:serverName', (req, res) => {
  //sample GET request at 'test/dev1'
  var _name = req.params.serverName;
  var server = servers[_name];
  var _protocol = server.protocol;
  var _host = server.host;
  var _port = server.port;
  var _sendRate = 100;
  starNewClient(_host, _port, _sendRate, _protocol, res);
  sendStatistics(res);
})
app.get('/testGradualIncrease/:serverName/:delay', (req, res) => {
  //sample GET request at 'test/dev1'
  var _name = req.params.serverName;
  var server = servers[_name];
  var _protocol = server.protocol;
  var _host = server.host;
  var _port = server.port;
  var _sendRate = 100;
  var delay = req.params.delay;
  if (delay == null || delay < 1000) delay = 1000;

  if (gradualInterval != null) clearInterval(gradualInterval);
  gradualInterval = setInterval(() => {
    starNewClient(_host, _port, _sendRate, _protocol, res);
  }, delay);
  sendStatistics(res);
})
app.get('/stopGradualIncrease', (req, res) => {
  if (gradualInterval != null) clearInterval(gradualInterval);
  sendStatistics(res);
})

app.get('/test/:protocol/:host/:port/:sendRate', (req, res) => {
  //sample GET request at 'test/ws/127.0.0.1/8887/100'
  // http://127.0.0.1:5000/test/ws/127.0.0.1/8887/100
  var _protocol = req.params.protocol;//gets 127.0.0.1
  var _host = req.params.host;//gets 8887
  var _port = req.params.port;//gets 8887
  var _sendRate = req.params.sendRate;//gets 100
  starNewClient(_host, _port, _sendRate, _protocol, res);
  sendStatistics(res);
})
app.get('/stop/:serverId', (req, res) => {
  //sample GET request at 'test/dev1/100'
  var id = req.params.serverId;
  var client = clients[id];
  client.stop();
  sendStatistics(res);
})

function starNewClient(_host, _port, _sendRate, _protocol, res) {
  console.log(`testing ://${_host}:${_port} , sendRate:${_sendRate}`);
  var client = new Client();
  client.Start(_host, _port, _protocol, _sendRate);
  client.onConnected = function (id) {
    console.log("connected:" + id);
  };
  client.onDisconnected = function (id, isError, errorMessage) {
    if (!isError)
      console.log("disconnected:" + id);

    else
      console.log("disconnected:" + id + " , error:" + errorMessage);
  };
  clients.push(client);
}

function sendStatistics(res, autoRefresh = false) {

  var statistics = '';
  if (autoRefresh)
    statistics += `
  <script>
  setInterval(() => {
    document.location.href="/";
  }, 1000);
  </script>`;

  statistics += `
  client # : id: ## , isConnected: # , isAuthorized: # , host: ########################### <br>`;

  for (var i = 0; i < clients.length; i++) {
    var client = clients[clients.length-1-i];
    statistics += `client ${i} : id:${client.getId()} , isConnected:${client.isConnected()} , isAuthorized:${client.isAuthorized()}, host:${client.getHost()} ,error:${client.getError()}<br>`;
  }
  res.status(200).send(statistics);
}

function Client() {
  var ws = null;
  var that = this;
  var sendRate = 100;
  var userID = 0;
  var objectID = 4;
  var componentID = 2;
  var keepAliveInterval = null;
  var syncObjectInterval = null;
  var host = "";
  var errorMessage = "";
  var hasError = false;

  this.getId = function () { return userID; };
  this.getHost = function () { return host; };
  this.getError = function () { return errorMessage; };
  this.isConnected = function () { return ws != null; };
  this.isAuthorized = function () { return userID != 0; };

  this.onConnected = function (id) { };
  this.onDisconnected = function (id, isError, errorMessage) { };
  this.stop = function () {
    ws.close();
  }
  this.Start = function (_host, _port, _protocol, _sendRate) {
    host = _host;
    ws = new WebSocket(`${_protocol}://${_host}:${_port}`);
    if (_sendRate == null) _sendRate = 1000;
    if (_sendRate < 1) _sendRate = 1000;
    that.sendRate = _sendRate;
    //ws events
    ws.on('open', function open() {
      onConnect(ws);
    });
    ws.on('close', function message(data) {
      onDisconnect(ws, hasError, errorMessage);
      ws = null;
    });
    ws.on('error', function error(err) {
      console.log(err);
      errorMessage = err;
      hasError = true;
    });
    ws.on('message', function incoming(data) {
      onMessage(ws, data);

    });
  };

  //private--------------------------------------
  function onConnect(ws) {
    send(ws, messagesIds.PromoteToUser, null, null, null, null);
  }
  function onDisconnect(ws, hasError, errorMessage) {
    clearInterval(keepAliveInterval);
    clearInterval(syncObjectInterval);
    that.onDisconnected(userID, hasError, errorMessage);
  }
  function onMessage(ws, data) {
    var byteArray = new Uint8Array(data);
    var msg = new Message(byteArray)
    //console.log("<<<" + msg.toString());
    switch (msg.id) {
      case messagesIds.PromoteToUser:
        userID = msg.sender;
        that.onConnected(userID);
        send(ws, messagesIds.Spawn, userID, objectID, null, [0, 36, 0, 0, 0, 100, 53, 99, 54, 56, 101, 56, 98, 45, 97, 101, 97, 53, 45, 52, 101, 53, 55, 45, 97, 99, 52, 102, 45, 57, 101, 101, 49, 99, 99, 50, 54, 52, 102, 53, 55]);

        setTimeout(() => {
          //simulate KeepAlive data every 3 seconds
          keepAliveInterval = setInterval(() => {
            send(ws, messagesIds.KeepAlive, userID, null, null, null);
          }, 3000);
          // simulate SyncNetworkObject data 30 times per second
          syncObjectInterval = setInterval(() => {
            send(ws, messagesIds.SyncNetworkObject, userID, objectID, componentID, [Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), 62, 145, 191, 0, 30, 172, 188, 0, 0, 0, 52, 148, 15, 140, 191, 0, 0, 99, 0, 0, 0, 0, 0]);
            send(ws, messagesIds.SyncNetworkObject, userID, objectID, componentID, [Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), Math.floor(Math.random() * 240), 62, 145, 191, 0, 30, 172, 188, 0, 0, 0, 52, 148, 15, 140, 191, 0, 0, 99, 0, 0, 0, 0, 0]);
          }, sendRate);
        }, 500);
        break;
    }
  }

  function send(socket, id, sender, objectID, componentID, payloadArray) {
    var buffer = new ArrayBuffer(50);
    const bufferView = new Int8Array(buffer);
    bufferView[1] = id;
    var headerLength = 1;
    if (sender != null) {
      bufferView[2] = sender;
      bufferView[3] = 0;
      headerLength += 2;
    }
    if (objectID != null) {
      bufferView[4] = objectID;
      headerLength++;
    }
    if (componentID != null) {
      bufferView[5] = componentID;
      headerLength++;
    }
    if (payloadArray == null) {
      payloadArray = [];
    }
    bufferView[0] = headerLength;
    bufferView[headerLength + 1] = payloadArray.length;

    for (var i = 0; i < payloadArray.length; i++) {
      bufferView[headerLength + 2 + i] = payloadArray[i];
    }
    //console.log(">>>" + bufferView);
    socket.send(buffer);
  }

  messagesIds = {
    PromoteToUser: 1,
    UserConnected: 2,
    UserDisconnected: 3,
    Spawn: 4,
    DeSpawn: 5,
    ServerReady: 6,
    KeepAlive: 7,
    UserDataChanged: 11,
    SyncNetworkObject: 12,
    RPC: 13,
  }

  function Message(data) {
    this.headerLength = data[0];
    this.PayloadLength = data[this.headerLength + 1];
    this.id = data[1];
    if (this.headerLength >= 2) {
      this.sender = data[2];
    }
    if (this.headerLength >= 4) {
      this.objectID = data[4];
    }
    if (this.headerLength >= 5) {
      this.componentID = data[5];
    }

    this.payload = data.slice(this.headerLength + 2, this.headerLength + 2 + this.PayloadLength);

    this.toString = function () {
      return "id:" + this.id + " sender:" + this.sender + " objectID:" + this.objectID + " componentID:" + this.componentID + " payload:" + this.payload;
    }
  }
}

// Port Number
const PORT = process.env.PORT || 5000;
// Server Setup
app.listen(PORT, console.log(
  `Server started on port ${PORT}`));


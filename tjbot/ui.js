/***************************************************************************
* Copyright 2018 IBM
*
*   Virtual TJBot Nodes for Node-RED
*
*   By JeanCarl Bisson (@dothewww)
*   More info: https://ibm.biz/node-red-contrib-virtual-tjbot
*
*   Licensed under the Apache License, Version 2.0 (the "License");
*   you may not use this file except in compliance with the License.
*   You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
*   Unless required by applicable law or agreed to in writing, software
*   distributed under the License is distributed on an "AS IS" BASIS,
*   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*   See the License for the specific language governing permissions and
*   limitations under the License.
****************************************************************************/

var inited = false;
var tjbotPath;

module.exports = function(RED) {
  if(!inited) {
    inited = true;
    init(RED.server, RED.httpNode || RED.httpAdmin, RED.log, RED.settings);
  }

  return {
    emit: emit,
    getPath: getPath
  };
};

const fs = require("fs");
const path = require("path");
const socketio = require("socket.io");
const serveStatic = require("serve-static");
var settings = {};
var io;
var state = {led: {color: "off"}, arm: {position: "raiseArm"}};

//from: https://stackoverflow.com/a/28592528/3016654
function join() {
  const trimRegex = new RegExp("^\\/|\\/$","g"),
  paths = Array.prototype.slice.call(arguments);
  return "/"+paths.map(function(e) {return e.replace(trimRegex,"");}).filter(function(e) {return e;}).join("/");
}

function init(server, app, log, redSettings) {
  tjbotPath = join(redSettings.httpNodeRoot, "tjbot");
  const socketIoPath = join(tjbotPath, "socket.io");
  const bodyParser = require("body-parser");

  app.use(bodyParser.json({limit: "50mb"}));
  app.use(tjbotPath, serveStatic(path.join(__dirname, "dist")));

  io = socketio(server, {path: socketIoPath});

  io.on("connection", socket => {
    socket.emit("config", state);
  });
}

function emit(command, params) {
  io.emit(command, params);

  switch(command) {
    case "shine":
      state.led.color = params.color;
    break;
    case "pulse":
      state.led.color = "off";
    break;
    case "armBack":
    case "lowerArm":
    case "raiseArm":
    case "wave":
      state.arm.position = command;
    break;
  }
}

function getPath() {
  return tjbotPath;
}
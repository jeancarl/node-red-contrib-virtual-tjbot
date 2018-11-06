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

module.exports = function(RED) {
  const ui = require("./ui.js")(RED);

  function vtjbotNodeListen(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    node.apiToken = "";
    node.lastMsg = null; // is null when not listening
    const bot = RED.nodes.getNode(config.botId);
    const watson = require("watson-developer-cloud");

    const LISTEN_CALLBACK = ui.getPath()+"/"+node.id+"/listen";
  
    function getToken(creds) {
      return new Promise((resolve, reject) => {
        if(node.apiToken != "") {
          resolve({token: node.apiToken});
        }
  
        const authorization = new watson.AuthorizationV1({
          iam_apikey: bot.services.speech_to_text.apikey,
          url: watson.SpeechToTextV1.URL
        });
      
        authorization.getToken(function (err, token) {
          if(!token) {
            reject({err: err});
          } else {
            node.apiToken = token;
            resolve({token: token});
          }
        });
      });
    }
  
    function getVoiceModel(creds, language) {
      return new Promise((resolve, reject) => {
        resolve(language+"_BroadbandModel");
      });
    }

    RED.httpNode.post(LISTEN_CALLBACK, (req, res) => {
      // NOTE: node.lastMsg is null when not listening. If any messages come
      // in when not listening (such as an utterance transcribed after listening
      // is stopped, the message is not processed and is dropped).

      if(node.lastMsg !== null) {
        const msg = node.lastMsg;
        msg.payload = req.body.text;

        node.send(msg);
        res.send({});
      } else {
        res.send({"error": "node inactive"});
      }
    });

    getVoiceModel(bot.services.speech_to_text, bot.configuration.listen.language).then(model => {
      node.on("input", function(msg) {
        if(bot.hardware.indexOf("microphone") === -1) {
          return node.error("TJBot is not configured to listen. Please check you enabled the microphone in the TJBot configuration.");
        }

        switch(msg.mode) {
          case "start":
          case "resume":
            getToken(bot.services.speech_to_text).then(token => {
              node.lastMsg = msg;
              ui.emit("listen", {token: token.token, callback: LISTEN_CALLBACK, model:model});
              node.status({fill: "green", shape: "dot", text: "listening"});
            }).catch(err => {
              return node.error("Unable to get Speech to Text token");
            });
          break;
          case "pause":
          case "stop":
            ui.emit("stopListening", {});
            node.lastMsg = null; // last msg is null when not listening
            node.status({fill: "red", shape: "dot", text: msg.mode == "pause" ? "paused": "stopped"});
          break;
        }
      });  
    }).catch(err => {
      node.error("Unable to get Speech to Text model");
    });

    node.on("close",function() {
      function removeRoute(path) {
        RED.httpNode._router.stack.forEach(function(route,i,routes) {
          if(route.route && route.route.path === path) {
            routes.splice(i,1);
          }
        });
      }

      removeRoute(LISTEN_CALLBACK);
    }); 
  }

  RED.nodes.registerType("vtjbot-listen", vtjbotNodeListen);
}

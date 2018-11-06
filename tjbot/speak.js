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
  const fs = require("fs"); 
  
  function vtjbotNodeSpeak(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const bot = RED.nodes.getNode(config.botId);
    const watson = require("watson-developer-cloud");

    const MEDIA_CALLBACK = ui.getPath()+"/"+node.id+"/play/:token";
    const PLAY_CALLBACK = ui.getPath()+"/"+node.id+"/playFinished";

    node.playTokens = {};
    node.apiToken = "";
    node.lastMsg = null; // is null when not speaking

    RED.httpNode.post(PLAY_CALLBACK, (req, res) => {
      // NOTE: node.lastMsg is null when not speaking. If any messages come
      // in when not speaking the message is not processed and is dropped).
              
      if(node.lastMsg !== null) {
        const msg = node.lastMsg;

        node.lastMsg = null;
        
        node.send(msg);
        node.status({});
        res.send({});
      } else {
        res.send({"error": "node inactive"});
      }
    });

    RED.httpNode.get(MEDIA_CALLBACK, (req, res) => {
      if(node.playTokens.hasOwnProperty(req.params.token)) {
        const file = node.playTokens[req.params.token];
        
        delete node.playTokens[req.params.token];

        fs.createReadStream(file).pipe(res);
      } else {
        node.error("unable to play file");
        res.status(404);
      }
    });      
  
    function getToken(creds) {
      return new Promise((resolve, reject) => {
        if(node.apiToken != "") {
          resolve({token: node.apiToken});
        }
  
        const authorization = new watson.AuthorizationV1({
          iam_apikey: bot.services.text_to_speech.apikey,
          url: watson.TextToSpeechV1.URL
        });
      
        authorization.getToken(function (err, token) {
          if(!token) {
            reject({err:err});
          } else {
            node.apiToken = token;
            resolve({token:token});
          }
        });
      });
    }
  
    function getVoiceModel(creds, language, gender) {
      return new Promise((resolve, reject) => {
        const TextToSpeechV1 = require("watson-developer-cloud/text-to-speech/v1");
        const textToSpeech = new TextToSpeechV1(
          {
            iam_apikey: bot.services.text_to_speech.apikey
          }
        );
  
        textToSpeech.listVoices({}, function(err, voices) {
          if(err) {
            reject({err:err});
          }

          // Default to a voice if a model isn't found.
          var voice = "en-US_MichaelVoice";

          voices.voices.forEach(function(v) {
            if(v.language == language && v.gender == gender) {
              voice = v.name;
            }
          });
  
          resolve(voice);
        });
      });
    }

    getVoiceModel(bot.services.text_to_speech, bot.configuration.speak.language, bot.configuration.robot.gender).then(voice => {
      node.on("input", function(msg) {
        if(bot.hardware.indexOf("speaker") === -1) {
          return node.error("TJBot is not configured to speak. Please check you enabled the speaker in the TJBot configuration.");
        }

        const mode = msg.mode||config.mode;
        
        switch(mode) {
          case "speak":
            getToken(bot.services.text_to_speech).then(token => {
              node.lastMsg = msg;
              ui.emit("speak", {token: token.token, callback: PLAY_CALLBACK, text: msg.payload, voice:voice});
              node.status({fill: "green", shape: "dot", text: "speaking"});
            });
          break;
          case "play":
            // create a play token that is requested by the UI for the audio file
            const token = Math.floor(Math.random()*1000000);
            node.playTokens[token] = msg.payload||config.payload;

            if(!fs.existsSync(node.playTokens[token])) {
              node.error("file does not exist");
              node.status({});
            } else {
              node.lastMsg = msg;
              ui.emit("play", {callback: PLAY_CALLBACK, url: MEDIA_CALLBACK});
              node.status({fill: "green", shape: "dot", text: "playing"});
            }
          break;
        }
      });  
    });

    node.on("close",function() {
      function removeRoute(path) {
        RED.httpNode._router.stack.forEach(function(route,i,routes) {
          if(route.route && route.route.path === path) {
            routes.splice(i,1);
          }
        });
      }

      removeRoute(MEDIA_CALLBACK);
      removeRoute(PLAY_CALLBACK);
    }); 
  }

  RED.nodes.registerType("vtjbot-speak", vtjbotNodeSpeak);
}

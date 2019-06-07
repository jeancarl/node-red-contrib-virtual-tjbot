/***************************************************************************
* Copyright 2019 IBM
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

module.exports = function (RED) {
  const ui = require("./ui.js")(RED);
  const fs = require("fs");
  const TextToSpeechV1 = require("ibm-watson/text-to-speech/v1");

  function vtjbotNodeSpeak(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const bot = RED.nodes.getNode(config.botId);

    const MEDIA_CALLBACK = ui.getPath() + "/" + node.id + "/play/:token";
    const PLAY_CALLBACK = ui.getPath() + "/" + node.id + "/playFinished";

    node.playTokens = {};
    node.apiToken = "";
    node.voices = [];
    node.lastMsg = null; // is null when not speaking

    RED.httpNode.post(PLAY_CALLBACK, (req, res) => {
      // NOTE: node.lastMsg is null when not speaking. If any messages come
      // in when not speaking the message is not processed and is dropped).

      if (node.lastMsg !== null) {
        const msg = node.lastMsg;

        node.lastMsg = null;

        node.send(msg);
        node.status({});
        res.send({});
      } else {
        res.send({ "error": "node inactive" });
      }
    });

    RED.httpNode.get(MEDIA_CALLBACK, (req, res) => {
      if (node.playTokens.hasOwnProperty(req.params.token)) {
        const file = node.playTokens[req.params.token];

        delete node.playTokens[req.params.token];

        fs.createReadStream(file).pipe(res);
      } else {
        node.error("Unable to play file");
        res.status(404);
      }
    });

    function getToken() {
      return new Promise((resolve, reject) => {
        if (node.apiToken != "") {
          return resolve({ token: node.apiToken });
        }

        const AuthorizationV1 = require("ibm-watson/authorization/v1");
        const authorization = new AuthorizationV1({
          iam_apikey: bot.services.text_to_speech.apikey,
          url: bot.services.text_to_speech.url || TextToSpeechV1.URL
        });

        authorization.getToken((err, token) => {
          if (!token) {
            return reject(err);
          } else {
            node.apiToken = token;
            return resolve({ token: token });
          }
        });
      });
    }

    function getVoices() {
      return new Promise((resolve, reject) => {
        if (node.voices.length > 0) {
          return resolve(node.voices);
        } else {
          const textToSpeech = new TextToSpeechV1({
            iam_apikey: bot.services.text_to_speech.apikey,
            url: bot.services.text_to_speech.url || TextToSpeechV1.URL
          });

          textToSpeech.listVoices()
            .then(voices => {
              node.voices = voices.voices;
              return resolve(node.voices);
            })
            .catch(error => {
              if (error.code == 400 || error.code == 401) {
                return reject("TJBot is not configured to speak. Please check you included credentials for the Watson Text to Speech service in the TJBot configuration.");
              } else {
                return reject(error.toString());
              }
            });
        }
      })
    }

    function getVoiceModel(language, gender) {
      return new Promise((resolve, reject) => {
        getVoices().then(voices => {
          var voice = "en-US_MichaelVoice";

          voices.forEach(v => {
            if (v.language == language && v.gender == gender) {
              voice = v.name;
            }
          });

          resolve(voice);
        })
          .catch(reject);
      });
    }

    node.on("input", function (msg) {
      if (!bot || bot.hardware.indexOf("speaker") === -1) {
        return node.error("TJBot is not configured to speak. Please check you enabled the speaker in the TJBot configuration.");
      }

      const mode = msg.mode || config.mode;

      switch (mode) {
        case "speak":
          if (!(bot && bot.services.text_to_speech && bot.services.text_to_speech.apikey && bot.services.text_to_speech.apikey.length)) {
            return node.error("TJBot is not configured to speak. Please check you included credentials for the Watson Text to Speech service in the TJBot configuration.");
          }

          getVoiceModel(bot.configuration.speak.language, bot.configuration.robot.gender).then(voice => {
            getToken().then(token => {
              node.lastMsg = msg;

              const url = bot.services.text_to_speech.url || TextToSpeechV1.URL;
              ui.emit("speak", { url: url, token: token.token, callback: PLAY_CALLBACK, text: msg.payload, voice: voice });
              node.status({ fill: "green", shape: "dot", text: "speaking" });
            }).catch(error => {
              return node.error(error);
            });
          }).catch(error => {
            return node.error(error);
          });
          break;
        case "play":
          // create a play token that is requested by the UI for the audio file
          const token = Math.floor(Math.random() * 1000000);
          node.playTokens[token] = msg.payload || config.payload;

          if (!fs.existsSync(node.playTokens[token])) {
            node.error("File does not exist");
            node.status({});
          } else {
            node.lastMsg = msg;
            ui.emit("play", { callback: PLAY_CALLBACK, url: MEDIA_CALLBACK });
            node.status({ fill: "green", shape: "dot", text: "playing" });
          }
          break;
        default:
          return node.error("No mode selected");
      }
    });

    node.on("close", function () {
      function removeRoute(path) {
        RED.httpNode._router.stack.forEach(function (route, i, routes) {
          if (route.route && route.route.path === path) {
            routes.splice(i, 1);
          }
        });
      }

      removeRoute(MEDIA_CALLBACK);
      removeRoute(PLAY_CALLBACK);
    });
  }

  RED.nodes.registerType("vtjbot-speak", vtjbotNodeSpeak);
}

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

  function vtjbotNodeTranslate(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const bot = RED.nodes.getNode(config.botId);
    const LanguageTranslatorV3 = require("ibm-watson/language-translator/v3");

    node.availableModels = [];

    if (!bot || !bot.services.language_translator || !bot.services.language_translator.apikey || !bot.services.language_translator.apikey.length) {
      node.on("input", msg => {
        return node.error("TJBot is not configured to analyze tone. Please check you included credentials for the Watson Language Translator service in the TJBot configuration.");
      });
      return;
    }

    const languageTranslator = new LanguageTranslatorV3({
      version: "2018-05-01",
      iam_apikey: bot.services.language_translator.apikey,
      url: bot.services.language_translator.url || LanguageTranslatorV3.URL
    });

    function getModels() {
      return new Promise((resolve, reject) => {
        if (node.availableModels.length > 0) {
          resolve(node.availableModels);
        } else {
          languageTranslator.listModels({})
            .then(models => {
              node.availableModels = models.models;
              resolve(node.availableModels);
            })
            .catch(error => {
              reject(error);
            })
        }
      })
    }

    function getModel(srcLang, targetLang) {
      return new Promise((resolve, reject) => {
        getModels()
          .then(models => {
            for (var i = 0; i < models.length; i++) {
              if (models[i].source == srcLang && models[i].target == targetLang) {
                return resolve(models[i]);
              }
            }

            return resolve(null);
          })
          .catch(error => {
            reject(error);
          })
      })
    }

    node.on("input", function (msg) {
      const mode = msg.mode || config.mode;

      switch (mode.toLowerCase()) {
        case "identifylanguage":
          languageTranslator.identify({
            text: msg.payload
          })
            .then(identifiedLanguages => {
              msg.response = identifiedLanguages;
              node.send(msg);
            })
            .catch(error => {
              node.error(error);
            });
          break;
        case "istranslatable":
          var srcLang = msg.srcLang || config.srcLang;
          var targetLang = msg.targetLang || config.targetLang;

          getModel(srcLang, targetLang)
            .then(model => {
              msg.response = model != null;
              node.send(msg);
            })
            .catch(error => {
              return node.error(error);
            });
          break;
        case "translate":
          var srcLang = msg.srcLang || config.srcLang;
          var targetLang = msg.targetLang || config.targetLang;
          getModel(srcLang, targetLang)
            .then(model => {
              if (model) {
                languageTranslator.translate({
                  text: msg.payload,
                  model_id: model.model_id
                })
                  .then(translation => {
                    msg.response = translation;
                    node.send(msg);
                  })
                  .catch(error => {
                    return node.error(error);
                  });
              } else {
                return node.error("no translation model exists");
              }
            })
            .catch(error => {
              return node.error(error);
            });
          break;
        default:
          return node.error("No mode selected");
      }
    });
  }

  RED.nodes.registerType("vtjbot-translate", vtjbotNodeTranslate);
}

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

module.exports = function(RED) {
  const ui = require("./ui.js")(RED);

  function vtjbotNodeTranslate(config) {
    RED.nodes.createNode(this, config);
    
    const node = this;
    const bot = RED.nodes.getNode(config.botId);
    const LanguageTranslatorV3 = require("watson-developer-cloud/language-translator/v3");
    
    let availableModels = {};

    const languageTranslator = new LanguageTranslatorV3({
      version: "2018-05-01",
      iam_apikey: bot.services.language_translator.apikey,
      url: bot.services.language_translator.url||LanguageTranslatorV3.URL
    });

    function getModel(srcLang, targetLang) {
      for(var i=0; i<availableModels.length; i++) {
        if(availableModels[i].source == srcLang && availableModels[i].target == targetLang) {
          return availableModels[i];
        }
      }

      return null;
    }

    languageTranslator.listModels({}, function(err, models) {
      if(err) {
        node.on("input", function(msg) {
          node.error(err);
        });

        return node.error(err);
      } else {
        availableModels = models.models;
    
        node.on("input", function(msg) {
          const mode = msg.mode||config.mode;
          
          switch(mode.toLowerCase()) {
            case "identifylanguage":
              languageTranslator.identify({
                text: msg.payload
              }, function(err, identifiedLanguages) {
                if(err) {
                  node.error(err);
                } else {
                  msg.response = identifiedLanguages;
                  node.send(msg);
                }
              });
            break;
            case "istranslatable":
              var srcLang = msg.srcLang||config.srcLang;
              var targetLang = msg.targetLang||config.targetLang;
              var model = getModel(srcLang, targetLang);

              msg.response = model != null;
              node.send(msg);
            break;
            case "translate":
              var srcLang = msg.srcLang||config.srcLang;
              var targetLang = msg.targetLang||config.targetLang;
              var model = getModel(srcLang, targetLang);

              if(model) {
                languageTranslator.translate({
                    text: msg.payload,
                    model_id: model.model_id
                  }, function(err, translation) {
                    if (err) {
                      node.error(err);
                    } else {
                      msg.response = translation;
                      node.send(msg);
                    }
                });
              } else {
                node.error("no translation model exists");
              }
            break;
          }
        });
      }
    });
  }

  RED.nodes.registerType("vtjbot-translate", vtjbotNodeTranslate);
}

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
  function vTJBotNodeAnalyzeTone(config) {
    RED.nodes.createNode(this, config);
    
    const node = this;
    const bot = RED.nodes.getNode(config.botId);
    const ToneAnalyzerV3 = require("watson-developer-cloud/tone-analyzer/v3");

    const toneAnalyzer = new ToneAnalyzerV3({
      iam_apikey: bot.services.tone_analyzer.apikey,
      version: "2017-09-21",
      url: bot.services.tone_analyzer.url||ToneAnalyzerV3.URL
    });

    node.on("input", function(msg) {
      toneAnalyzer.tone({
        text: msg.payload,
        content_type: "text/plain"
      }, function(err, response) {
        if(err) {
          node.error(err);
        } else {
          msg.response = response;
          
          node.send(msg);
        }
      });
    });
  }

  RED.nodes.registerType("vtjbot-analyze-tone", vTJBotNodeAnalyzeTone);
}

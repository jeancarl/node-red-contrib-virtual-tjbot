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
  function vtjbotNodeConverse(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const workspaceContext = {};
    const bot = RED.nodes.getNode(config.botId);

    node.on("input", function(msg) {
      const payload = msg.payload;

      if(typeof payload !== "string") {
        return node.error("Payload must be a string");
      }

      const AssistantV1 = require("watson-developer-cloud/assistant/v1");
      const assistant = new AssistantV1({
        iam_apikey: bot.services.assistant.apikey,
        version: "2018-02-16"
      });

      const workspaceId = bot.services.assistant.workspaceId;

      assistant.message({
        workspace_id: workspaceId,
        input: {"text": payload},
        context: msg.context||workspaceContext[workspaceId]||{}
      }, function(err, response) {
        if(err) {
          return node.error(err);
        }

        msg.response = {
          "object": response,
          "description": response.output.text.length > 0 ? response.output.text[0] : ""
        };

        workspaceContext[workspaceId] = response.context;

        node.send(msg);
      });
    });
  }

  RED.nodes.registerType("vtjbot-converse", vtjbotNodeConverse);
}

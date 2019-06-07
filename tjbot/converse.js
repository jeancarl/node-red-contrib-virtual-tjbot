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
  function vtjbotNodeConverse(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const workspaceContext = {};
    const bot = RED.nodes.getNode(config.botId);
    const AssistantV1 = require("ibm-watson/assistant/v1");

    node.on("input", function (msg) {
      if (!bot || !bot.services.assistant || !bot.services.assistant.apikey || !bot.services.assistant.apikey.length || !bot.services.assistant.workspaceId || !bot.services.assistant.workspaceId.length) {
        return node.error("TJBot is not configured to converse. Please check you included credentials for the Watson Assistant service in the TJBot configuration.");
      }

      const payload = msg.payload;

      if (typeof payload !== "string") {
        return node.error("Payload must be a string");
      }

      const assistant = new AssistantV1({
        iam_apikey: bot.services.assistant.apikey,
        version: "2018-02-16",
        url: bot.services.assistant.url || AssistantV1.URL,
      });

      const workspaceId = bot.services.assistant.workspaceId;

      assistant.message({
        workspace_id: workspaceId,
        input: { "text": payload },
        context: msg.context || workspaceContext[workspaceId] || {}
      })
        .then(response => {
          msg.response = {
            "object": response,
            "description": response.output.text.length > 0 ? response.output.text[0] : ""
          };

          workspaceContext[workspaceId] = response.context;

          node.send(msg);
        })
        .catch(error => {
          return node.error(error);
        });
    });
  }

  RED.nodes.registerType("vtjbot-converse", vtjbotNodeConverse);
}

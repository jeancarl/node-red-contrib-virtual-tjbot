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

  function vTJBotNodeWave(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const bot = RED.nodes.getNode(config.botId);

    node.on("input", function (msg) {
      if (!bot || bot.hardware.indexOf("servo") === -1) {
        return node.error("TJBot is not configured with an servo. Please check you enabled the servo in the TJBot configuration.");
      }

      const motion = config.motion == "msg.motion" ? msg.motion : config.motion;

      switch (motion.toLowerCase()) {
        case "armback":
          ui.emit("armBack", {});
          break;
        case "lowerarm":
          ui.emit("lowerArm", {});
          break;
        case "raisearm":
          ui.emit("raiseArm", {});
          break;
        case "wave":
          ui.emit("wave", {});
          break;
        default:
          return node.error("No mode selected");
      }
    });
  }

  RED.nodes.registerType("vtjbot-wave", vTJBotNodeWave);
}
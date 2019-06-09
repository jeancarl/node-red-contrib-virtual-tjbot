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
  const colors = ["crimson", "pink", "palevioletred", "orchid", "plum", "violet", "fuchsia", "purple", "blueviolet", "slateblue", "blue", "navy", "cornflowerblue", "slategray", "steelblue", "skyblue", "powderblue", "cadetblue", "paleturquoise", "cyan", "springgreen", "seagreen", "palegreen", "forestgreen", "chartreuse", "olivedrab", "yellowgreen", "beige", "yellow", "olive", "palegoldenrod", "cornsilk", "orange", "floralwhite", "oldlace", "wheat", "papayawhip", "blanchedalmond", "navajowhite", "burlywood", "bisque", "peru", "peachpuff", "seashell", "sandybrown", "chocolate", "saddlebrown", "sienna", "coral", "orangered", "salmon", "snow", "brown", "firebrick", "white", "silver", "black", "whitesmoke"];

  function vTJBotNodeShine(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const bot = RED.nodes.getNode(config.botId);

    node.on("input", function (msg) {
      if (!bot || bot.hardware.indexOf("led") === -1) {
        return node.error("TJBot is not configured with an LED. Please check you enabled the LED in the TJBot configuration.");
      }

      const color = config.color == "msg.color" ? msg.color : config.color;
      const duration = parseFloat(msg.duration || config.duration);
      const mode = config.mode == "msg.mode" ? msg.mode : config.mode;

      switch (mode.toLowerCase()) {
        case "shine":
          if (color == "random") {
            const randIdx = Math.floor(Math.random() * colors.length);
            ui.emit("shine", { color: colors[randIdx] });
          } else {
            ui.emit("shine", { color: color });
          }
          break;
        case "pulse":
          ui.emit("pulse", { color: color, duration: duration });
          break;
        default:
          return node.error("No mode selected");
      }
    });
  }

  RED.nodes.registerType("vtjbot-shine", vTJBotNodeShine);
}
